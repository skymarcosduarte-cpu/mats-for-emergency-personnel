import React, { useState, useEffect } from 'react';
import { Plus, X, ImagePlus, Calendar, Tag, DollarSign, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserRole } from '@/types';

interface MarketListing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  images: string[];
  valid_until: string;
  created_at: string;
}

interface MarketScreenProps {
  userRole?: UserRole;
}

const CATEGORIES = [
  { value: 'product', label: 'Producto' },
  { value: 'service', label: 'Servicio' },
  { value: 'equipment', label: 'Equipo' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'other', label: 'Otro' },
];

const MAX_IMAGES = 5;
const MAX_DAYS = 30;

export const MarketScreen: React.FC<MarketScreenProps> = ({ userRole = 'RESCATISTA' }) => {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('product');
  const [price, setPrice] = useState('');
  const [validDays, setValidDays] = useState('7');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los anuncios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > MAX_IMAGES) {
      toast({
        title: 'Límite de imágenes',
        description: `Máximo ${MAX_IMAGES} imágenes permitidas`,
        variant: 'destructive',
      });
      return;
    }

    const newImages = [...images, ...files].slice(0, MAX_IMAGES);
    setImages(newImages);

    // Create previews
    const newPreviews = newImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('product');
    setPrice('');
    setValidDays('7');
    setImages([]);
    setImagePreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa el título y descripción',
        variant: 'destructive',
      });
      return;
    }

    const days = parseInt(validDays);
    if (days < 1 || days > MAX_DAYS) {
      toast({
        title: 'Fecha inválida',
        description: `La vigencia debe ser entre 1 y ${MAX_DAYS} días`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload images
      const imageUrls: string[] = [];
      for (const image of images) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('marketplace_images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('marketplace_images')
          .getPublicUrl(fileName);

        imageUrls.push(publicUrl);
      }

      // Create listing
      const { error } = await supabase
        .from('marketplace_listings')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category,
          price: price ? parseFloat(price) : null,
          images: imageUrls,
          valid_until: addDays(new Date(), days).toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Anuncio publicado',
        description: 'Tu anuncio ha sido publicado exitosamente',
      });

      resetForm();
      setDialogOpen(false);
      fetchListings();
    } catch (error) {
      console.error('Error creating listing:', error);
      toast({
        title: 'Error',
        description: 'No se pudo publicar el anuncio',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  const getDaysRemaining = (validUntil: string) => {
    const days = differenceInDays(new Date(validUntil), new Date());
    return days;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              Compra y vende productos o servicios
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Publicar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo Anuncio</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Equipo de primeros auxilios"
                    maxLength={100}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe tu producto o servicio..."
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                {/* Category & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Precio (opcional)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="pl-9"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                {/* Valid Days */}
                <div className="space-y-2">
                  <Label htmlFor="validDays">Vigencia (días)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="validDays"
                      type="number"
                      value={validDays}
                      onChange={(e) => setValidDays(e.target.value)}
                      className="pl-9"
                      min="1"
                      max={MAX_DAYS}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Máximo {MAX_DAYS} días. El anuncio expirará automáticamente.
                  </p>
                </div>

                {/* Images */}
                <div className="space-y-2">
                  <Label>Imágenes ({images.length}/{MAX_IMAGES})</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {images.length < MAX_IMAGES && (
                      <label className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <ImagePlus className="w-6 h-6 text-muted-foreground" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publicando...
                      </>
                    ) : (
                      'Publicar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Listings Grid */}
        {listings.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay anuncios
            </h3>
            <p className="text-muted-foreground mb-4">
              Sé el primero en publicar un producto o servicio
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Publicar anuncio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => {
              const daysRemaining = getDaysRemaining(listing.valid_until);
              
              return (
                <Card key={listing.id} className="overflow-hidden">
                  {/* Image */}
                  {listing.images.length > 0 ? (
                    <div className="aspect-video relative">
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                      {listing.images.length > 1 && (
                        <span className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                          +{listing.images.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <Tag className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {listing.title}
                      </h3>
                      {listing.price && (
                        <span className="text-primary font-bold whitespace-nowrap">
                          ${listing.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {listing.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {getCategoryLabel(listing.category)}
                      </Badge>
                      <span className={`text-xs ${daysRemaining <= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {daysRemaining} días restantes
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketScreen;
