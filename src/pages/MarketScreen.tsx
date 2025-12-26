import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, ImagePlus, Calendar, Tag, DollarSign, Loader2, ChevronLeft, ChevronRight, Search, MessageCircle, Filter, Pencil, Trash2, User, Bell } from 'lucide-react';
import { createNotification } from '@/hooks/useNotifications';
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserRole } from '@/types';

interface SellerProfile {
  nickname: string;
  phone: string;
}

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
  profiles?: SellerProfile;
}

interface MarketScreenProps {
  userRole?: UserRole;
}

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'product', label: 'Producto' },
  { value: 'service', label: 'Servicio' },
  { value: 'equipment', label: 'Equipo' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'other', label: 'Otro' },
];

const FORM_CATEGORIES = CATEGORIES.filter(c => c.value !== 'all');

const MAX_IMAGES = 5;
const MAX_DAYS = 30;

export const MarketScreen: React.FC<MarketScreenProps> = ({ userRole = 'RESCATISTA' }) => {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
  const [editingListing, setEditingListing] = useState<MarketListing | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<MarketListing | null>(null);
  const { toast } = useToast();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('product');
  const [price, setPrice] = useState('');
  const [validDays, setValidDays] = useState('7');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  useEffect(() => {
    fetchListings();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchListings = async () => {
    try {
      const { data: listingsData, error: listingsError } = await supabase
        .from('marketplace_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set(listingsData?.map(l => l.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname, phone')
        .in('id', userIds);

      // Map profiles to listings
      const profilesMap = new Map(profilesData?.map(p => [p.id, { nickname: p.nickname, phone: p.phone }]) || []);
      
      const listingsWithProfiles = listingsData?.map(listing => ({
        ...listing,
        profiles: profilesMap.get(listing.user_id)
      })) || [];

      setListings(listingsWithProfiles);
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
    setExistingImages([]);
    setEditingListing(null);
  };

  const openEditDialog = (listing: MarketListing) => {
    setEditingListing(listing);
    setTitle(listing.title);
    setDescription(listing.description);
    setCategory(listing.category);
    setPrice(listing.price?.toString() || '');
    setValidDays('7');
    setExistingImages(listing.images);
    setImages([]);
    setImagePreviews([]);
    setDialogOpen(true);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
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
    if (!editingListing && (days < 1 || days > MAX_DAYS)) {
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

      // Upload new images
      const newImageUrls: string[] = [];
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

        newImageUrls.push(publicUrl);
      }

      const allImages = [...existingImages, ...newImageUrls];

      if (editingListing) {
        // Update existing listing
        const { error } = await supabase
          .from('marketplace_listings')
          .update({
            title: title.trim(),
            description: description.trim(),
            category,
            price: price ? parseFloat(price) : null,
            images: allImages,
          })
          .eq('id', editingListing.id);

        if (error) throw error;

        toast({
          title: 'Anuncio actualizado',
          description: 'Tu anuncio ha sido actualizado exitosamente',
        });
      } else {
        // Create new listing
        const { error } = await supabase
          .from('marketplace_listings')
          .insert({
            user_id: user.id,
            title: title.trim(),
            description: description.trim(),
            category,
            price: price ? parseFloat(price) : null,
            images: allImages,
            valid_until: addDays(new Date(), days).toISOString(),
          });

        if (error) throw error;

        toast({
          title: 'Anuncio publicado',
          description: 'Tu anuncio ha sido publicado exitosamente',
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchListings();
    } catch (error) {
      console.error('Error saving listing:', error);
      toast({
        title: 'Error',
        description: editingListing ? 'No se pudo actualizar el anuncio' : 'No se pudo publicar el anuncio',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (listing: MarketListing) => {
    setListingToDelete(listing);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;

    try {
      const { error } = await supabase
        .from('marketplace_listings')
        .delete()
        .eq('id', listingToDelete.id);

      if (error) throw error;

      toast({
        title: 'Anuncio eliminado',
        description: 'Tu anuncio ha sido eliminado exitosamente',
      });

      setDeleteConfirmOpen(false);
      setListingToDelete(null);
      setDetailOpen(false);
      fetchListings();
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el anuncio',
        variant: 'destructive',
      });
    }
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  const getDaysRemaining = (validUntil: string) => {
    const days = differenceInDays(new Date(validUntil), new Date());
    return days;
  };

  const handleListingClick = (listing: MarketListing) => {
    setSelectedListing(listing);
    setDetailOpen(true);
  };

  const handleContactSeller = async (listing: MarketListing) => {
    if (!listing.profiles?.phone) {
      toast({
        title: 'Sin contacto',
        description: 'El vendedor no tiene número de teléfono registrado',
        variant: 'destructive',
      });
      return;
    }

    // Get current user's profile for the notification message
    const { data: { user } } = await supabase.auth.getUser();
    let buyerName = 'Alguien';
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single();
      
      if (profile?.nickname) {
        buyerName = profile.nickname;
      }
    }

    // Create notification for the seller
    await createNotification({
      userId: listing.user_id,
      type: 'marketplace_contact',
      title: 'Alguien está interesado en tu anuncio',
      message: `${buyerName} te contactó por "${listing.title}"`,
      listingId: listing.id,
    });

    toast({
      title: 'Listo',
      description: 'El vendedor fue notificado dentro de la app.',
    });
  };

  // My listings
  const myListings = useMemo(() => {
    return listings.filter(listing => listing.user_id === currentUserId);
  }, [listings, currentUserId]);

  // Filtered listings based on view mode
  const filteredListings = useMemo(() => {
    const baseListings = viewMode === 'my' ? myListings : listings;
    
    return baseListings.filter(listing => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        listing.title.toLowerCase().includes(searchLower) ||
        listing.description.toLowerCase().includes(searchLower);

      // Category filter
      const matchesCategory = filterCategory === 'all' || listing.category === filterCategory;

      // Price filter
      const maxPrice = parseFloat(filterMaxPrice);
      const matchesPrice = !filterMaxPrice || !listing.price || listing.price <= maxPrice;

      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [listings, myListings, viewMode, searchQuery, filterCategory, filterMaxPrice]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterMaxPrice('');
  };

  const isOwnListing = (listing: MarketListing) => listing.user_id === currentUserId;

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
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => resetForm()}>
                <Plus className="w-4 h-4" />
                Publicar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingListing ? 'Editar Anuncio' : 'Nuevo Anuncio'}</DialogTitle>
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
                        {FORM_CATEGORIES.map((cat) => (
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

                {/* Valid Days - only for new listings */}
                {!editingListing && (
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
                )}

                {/* Images */}
                <div className="space-y-2">
                  <Label>Imágenes ({existingImages.length + images.length}/{MAX_IMAGES})</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {/* Existing images */}
                    {existingImages.map((url, index) => (
                      <div key={`existing-${index}`} className="relative aspect-square">
                        <img
                          src={url}
                          alt={`Existing ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* New image previews */}
                    {imagePreviews.map((preview, index) => (
                      <div key={`new-${index}`} className="relative aspect-square">
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
                    
                    {existingImages.length + images.length < MAX_IMAGES && (
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
                        {editingListing ? 'Guardando...' : 'Publicando...'}
                      </>
                    ) : (
                      editingListing ? 'Guardar cambios' : 'Publicar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('all')}
          >
            <Tag className="w-4 h-4 mr-2" />
            Todos
          </Button>
          <Button
            variant={viewMode === 'my' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('my')}
          >
            <User className="w-4 h-4 mr-2" />
            Mis anuncios ({myListings.length})
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar anuncios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-[140px]">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Precio máx."
                value={filterMaxPrice}
                onChange={(e) => setFilterMaxPrice(e.target.value)}
                className="pl-9"
                min="0"
              />
            </div>

            {(searchQuery || filterCategory !== 'all' || filterMaxPrice) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {filteredListings.length} {filteredListings.length === 1 ? 'anuncio' : 'anuncios'} encontrados
          </p>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {listings.length === 0 ? 'No hay anuncios' : 'Sin resultados'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {listings.length === 0 
                ? 'Sé el primero en publicar un producto o servicio'
                : 'Prueba con otros filtros de búsqueda'}
            </p>
            {listings.length === 0 ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Publicar anuncio
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListings.map((listing) => {
              const daysRemaining = getDaysRemaining(listing.valid_until);
              
              return (
                <Card 
                  key={listing.id} 
                  className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => handleListingClick(listing)}
                >
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

        {/* Listing Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            {selectedListing && (
              <>
                {/* Image Carousel */}
                {selectedListing.images.length > 0 ? (
                  <div className="relative">
                    <Carousel className="w-full">
                      <CarouselContent>
                        {selectedListing.images.map((image, index) => (
                          <CarouselItem key={index}>
                            <div className="aspect-video">
                              <img
                                src={image}
                                alt={`${selectedListing.title} - Imagen ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      {selectedListing.images.length > 1 && (
                        <>
                          <CarouselPrevious className="left-2" />
                          <CarouselNext className="right-2" />
                        </>
                      )}
                    </Carousel>
                    
                    {/* Image counter */}
                    {selectedListing.images.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                        {selectedListing.images.length} fotos
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <Tag className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {selectedListing.title}
                      </h2>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">
                          {getCategoryLabel(selectedListing.category)}
                        </Badge>
                        <span className={`text-sm ${getDaysRemaining(selectedListing.valid_until) <= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {getDaysRemaining(selectedListing.valid_until)} días restantes
                        </span>
                      </div>
                    </div>
                    {selectedListing.price && (
                      <div className="text-right">
                        <span className="text-3xl font-bold text-primary">
                          ${selectedListing.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <h3 className="font-semibold text-foreground mb-2">Descripción</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selectedListing.description}
                    </p>
                  </div>

                  {/* Seller info */}
                  {selectedListing.profiles && (
                    <div className="border-t border-border pt-4">
                      <h3 className="font-semibold text-foreground mb-2">Vendedor</h3>
                      <p className="text-muted-foreground">
                        {selectedListing.profiles.nickname || 'Usuario'}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-border pt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Publicado: {format(new Date(selectedListing.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                    <span>
                      Expira: {format(new Date(selectedListing.valid_until), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>

                  {/* Action buttons */}
                  {isOwnListing(selectedListing) ? (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline"
                        className="flex-1" 
                        size="lg"
                        onClick={() => setDetailOpen(false)}
                      >
                        Cerrar
                      </Button>
                      <Button 
                        variant="outline"
                        className="gap-2" 
                        size="lg"
                        onClick={() => {
                          setDetailOpen(false);
                          openEditDialog(selectedListing);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button 
                        variant="destructive"
                        className="gap-2" 
                        size="lg"
                        onClick={() => handleDeleteClick(selectedListing)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline"
                        className="flex-1" 
                        size="lg"
                        onClick={() => setDetailOpen(false)}
                      >
                        Cerrar
                      </Button>
                      <Button 
                        className="flex-1 gap-2" 
                        size="lg"
                        onClick={() => handleContactSeller(selectedListing)}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Contactar
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">Eliminar anuncio</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar el anuncio "{listingToDelete?.title}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteConfirm}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MarketScreen;
