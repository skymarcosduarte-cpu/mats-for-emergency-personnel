// Memory Gallery Component - "Galería del Recuerdo"
// Displays community nostalgic photos with likes, comments, date, and filters

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ImagePlus, Loader2, Trash2, X, Upload, Camera, 
  ArrowLeft, RefreshCw, ZoomIn, Heart, MessageCircle, Calendar, Send, Filter, User,
  Download, Share2, Copy, Check, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageGalleryViewer } from '@/components/ImageGalleryViewer';
import { useMemoryGallery, MemoryPhoto, PhotoComment } from '@/hooks/useMemoryGallery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MemoryGalleryProps {
  onBack: () => void;
}

interface UserInfo {
  id: string;
  nickname: string;
}

// View modes: 'selection' | 'all' | 'grouped'
type ViewMode = 'selection' | 'all' | 'grouped';

export const MemoryGallery: React.FC<MemoryGalleryProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { 
    photos, loading, uploading, uploadPhotos, deletePhoto, 
    toggleLike, getComments, addComment, deleteComment, refresh 
  } = useMemoryGallery();
  
  // View mode state - starts with selection screen
  const [viewMode, setViewMode] = useState<ViewMode>('selection');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [photoDate, setPhotoDate] = useState('');
  const [viewerImages, setViewerImages] = useState<{ images: string[]; index: number } | null>(null);
  
  // Filters
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Photo detail/comments dialog
  const [selectedPhoto, setSelectedPhoto] = useState<MemoryPhoto | null>(null);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique years from photos
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    photos.forEach(p => {
      if (p.photo_date) {
        years.add(new Date(p.photo_date).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [photos]);

  // Get unique user IDs from photos
  const uniqueUserIds = useMemo(() => {
    return [...new Set(photos.map(p => p.user_id))];
  }, [photos]);

  // Fetch user nicknames
  useEffect(() => {
    if (uniqueUserIds.length === 0) {
      setUsersLoading(false);
      return;
    }
    
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname')
          .in('id', uniqueUserIds);
        
        if (data) {
          setUsers(data.map(p => ({ id: p.id, nickname: p.nickname })));
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setUsersLoading(false);
      }
    };
    
    fetchUsers();
  }, [uniqueUserIds]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // Filter by year
      if (filterYear !== 'all') {
        if (!photo.photo_date) return false;
        const photoYear = new Date(photo.photo_date).getFullYear().toString();
        if (photoYear !== filterYear) return false;
      }
      
      // Filter by user
      if (filterUser !== 'all' && photo.user_id !== filterUser) {
        return false;
      }
      
      return true;
    });
  }, [photos, filterYear, filterUser]);

  // Active filter count
  const activeFilterCount = (filterYear !== 'all' ? 1 : 0) + (filterUser !== 'all' ? 1 : 0);

  // Clear filters
  const clearFilters = () => {
    setFilterYear('all');
    setFilterUser('all');
  };

  // Group photos by user
  const photosByUser = useMemo(() => {
    const grouped: Record<string, MemoryPhoto[]> = {};
    photos.forEach(photo => {
      if (!grouped[photo.user_id]) {
        grouped[photo.user_id] = [];
      }
      grouped[photo.user_id].push(photo);
    });
    return grouped;
  }, [photos]);

  // Toggle user expansion in grouped view
  const toggleUserExpansion = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Go back to selection from gallery view
  const handleBackToSelection = () => {
    setViewMode('selection');
    clearFilters();
    setExpandedUsers(new Set());
  };

  // Load comments when photo is selected
  useEffect(() => {
    if (selectedPhoto) {
      setLoadingComments(true);
      getComments(selectedPhoto.id).then(data => {
        setComments(data);
        setLoadingComments(false);
      });
    } else {
      setComments([]);
    }
  }, [selectedPhoto, getComments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > 20) {
      alert('Máximo 20 fotos por carga');
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) continue;
      
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    previews.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviews([]);
    setCaption('');
    setPhotoDate('');
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    const success = await uploadPhotos(selectedFiles, caption, photoDate || undefined);
    if (success) {
      handleClearAll();
      setShowUploadDialog(false);
    }
  };

  const handleDelete = async (photo: MemoryPhoto) => {
    if (!confirm('¿Eliminar esta foto?')) return;
    await deletePhoto(photo.id);
    if (selectedPhoto?.id === photo.id) {
      setSelectedPhoto(null);
    }
  };

  const handleLike = async (photo: MemoryPhoto, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await toggleLike(photo.id);
  };

  const handleSubmitComment = async () => {
    if (!selectedPhoto || !newComment.trim()) return;
    
    setSubmittingComment(true);
    const success = await addComment(selectedPhoto.id, newComment.trim());
    if (success) {
      setNewComment('');
      const updated = await getComments(selectedPhoto.id);
      setComments(updated);
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPhoto) return;
    await deleteComment(commentId, selectedPhoto.id);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const openViewer = (index: number) => {
    const allImages = filteredPhotos.map(p => p.image_url);
    setViewerImages({ images: allImages, index });
  };

  const openPhotoDetail = (photo: MemoryPhoto) => {
    setSelectedPhoto(photo);
  };

  const getUserNickname = (userId: string) => {
    return users.find(u => u.id === userId)?.nickname || 'Usuario';
  };

  // Download photo
  const handleDownload = async (photo: MemoryPhoto) => {
    try {
      const response = await fetch(photo.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recuerdo_${photo.photo_date || format(new Date(photo.created_at), 'yyyy-MM-dd')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Foto descargada');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Error al descargar');
    }
  };

  // Share photo
  const handleShare = async (photo: MemoryPhoto) => {
    const shareData = {
      title: 'Galería del Recuerdo',
      text: photo.caption || 'Mira esta foto del recuerdo 📸',
      url: photo.image_url,
    };

    // Try Web Share API first
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed, try clipboard fallback
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(photo.image_url);
      toast.success('Enlace copiado al portapapeles');
    } catch (err) {
      toast.error('No se pudo copiar el enlace');
    }
  };

  // Render photo card (reusable)
  const renderPhotoCard = (photo: MemoryPhoto) => (
    <div
      key={photo.id}
      className="relative aspect-square group rounded-lg overflow-hidden bg-muted cursor-pointer"
      onClick={() => openPhotoDetail(photo)}
    >
      <img
        src={photo.image_url}
        alt={photo.caption || 'Foto del recuerdo'}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
        loading="lazy"
      />
      {/* Stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center gap-3 text-white text-xs">
          <span className="flex items-center gap-1">
            <Heart className={cn("w-3 h-3", photo.user_has_liked && "fill-current text-destructive")} />
            {photo.likes_count || 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {photo.comments_count || 0}
          </span>
        </div>
      </div>
      {/* Date badge */}
      {photo.photo_date && (
        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
          <Calendar className="w-2.5 h-2.5" />
          {format(new Date(photo.photo_date), 'yyyy')}
        </div>
      )}
    </div>
  );

  // Render dialogs (shared across all views)
  const renderDialogs = () => (
    <>
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Subir Fotos del Recuerdo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Input */}
            <div>
              <Label className="text-sm font-medium">
                Seleccionar fotos (máximo 20)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Cada imagen debe ser menor a 5MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={selectedFiles.length >= 20}
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                Agregar fotos ({selectedFiles.length}/20)
              </Button>
            </div>

            {/* Previews Grid */}
            {previews.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{previews.length} foto{previews.length > 1 ? 's' : ''} seleccionada{previews.length > 1 ? 's' : ''}</Label>
                  <Button variant="ghost" size="sm" onClick={handleClearAll}>
                    <X className="w-4 h-4 mr-1" />
                    Limpiar
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {previews.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded overflow-hidden bg-muted">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo Date */}
            <div>
              <Label htmlFor="photoDate" className="text-sm font-medium">
                Fecha de la foto (opcional)
              </Label>
              <Input
                id="photoDate"
                type="date"
                value={photoDate}
                onChange={(e) => setPhotoDate(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Caption */}
            <div>
              <Label htmlFor="caption" className="text-sm font-medium">
                Descripción (opcional)
              </Label>
              <Input
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ej: Reunión 2015..."
                maxLength={200}
              />
            </div>

            {/* Upload Button */}
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir {selectedFiles.length} foto{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto p-0">
          {selectedPhoto && (
            <>
              {/* Image */}
              <div className="relative">
                <img
                  src={selectedPhoto.image_url}
                  alt={selectedPhoto.caption || 'Foto'}
                  className="w-full max-h-[50vh] object-contain bg-black cursor-pointer"
                  onClick={() => openViewer(filteredPhotos.findIndex(p => p.id === selectedPhoto.id))}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => openViewer(filteredPhotos.findIndex(p => p.id === selectedPhoto.id))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-4 space-y-4">
                {/* Author */}
                <p className="text-xs text-muted-foreground">
                  Subido por <span className="text-primary">@{getUserNickname(selectedPhoto.user_id)}</span>
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLike(selectedPhoto)}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Heart className={cn(
                        "w-5 h-5 transition-colors",
                        selectedPhoto.user_has_liked ? "fill-destructive text-destructive" : "text-muted-foreground"
                      )} />
                      <span>{selectedPhoto.likes_count || 0}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MessageCircle className="w-5 h-5" />
                      {selectedPhoto.comments_count || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleDownload(selectedPhoto)}
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleShare(selectedPhoto)}
                      title="Compartir"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    {selectedPhoto.user_id === user?.id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(selectedPhoto)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Caption & Date */}
                {(selectedPhoto.caption || selectedPhoto.photo_date) && (
                  <div className="space-y-1">
                    {selectedPhoto.caption && (
                      <p className="text-sm text-foreground">{selectedPhoto.caption}</p>
                    )}
                    {selectedPhoto.photo_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(selectedPhoto.photo_date), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                )}

                {/* Comments Section */}
                <div className="border-t border-border pt-4 space-y-3">
                  <h4 className="text-sm font-medium">Comentarios</h4>
                  
                  {loadingComments ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Sin comentarios aún
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {comments.map(comment => (
                        <div key={comment.id} className="flex gap-2 text-sm">
                          <span className="font-medium text-primary shrink-0">
                            @{comment.author_nickname}
                          </span>
                          <span className="text-foreground flex-1">{comment.comment}</span>
                          {comment.user_id === user?.id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment */}
                  <div className="flex gap-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Escribe un comentario..."
                      maxLength={200}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                    />
                    <Button
                      size="icon"
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim() || submittingComment}
                    >
                      {submittingComment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Máximo 200 caracteres</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Viewer */}
      <ImageGalleryViewer
        images={viewerImages?.images || []}
        initialIndex={viewerImages?.index || 0}
        open={!!viewerImages}
        onOpenChange={(open) => !open && setViewerImages(null)}
      />
    </>
  );

  // ===== SELECTION SCREEN =====
  if (viewMode === 'selection') {
    return (
      <div className="pb-20">
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Galería del Recuerdo</h1>
              <p className="text-xs text-muted-foreground">{photos.length} fotos en la galería</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Welcome message */}
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="py-6 text-center">
                  <Camera className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h2 className="text-lg font-semibold mb-2">¿Cómo quieres ver la galería?</h2>
                  <p className="text-sm text-muted-foreground">
                    Elige si deseas ver todas las fotos o explorar por usuario
                  </p>
                </CardContent>
              </Card>

              {/* View options */}
              <div className="grid grid-cols-1 gap-3">
                {/* View all option */}
                <Card 
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-2 hover:border-primary/50"
                  onClick={() => setViewMode('all')}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <ImagePlus className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">Ver toda la galería</h3>
                      <p className="text-sm text-muted-foreground">
                        Todas las {photos.length} fotos en orden cronológico
                      </p>
                    </div>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </CardContent>
                </Card>

                {/* View by user option */}
                <Card 
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-2 hover:border-primary/50"
                  onClick={() => setViewMode('grouped')}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">Ver por usuario</h3>
                      <p className="text-sm text-muted-foreground">
                        Fotos agrupadas por quien las subió ({users.length} usuarios)
                      </p>
                    </div>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </CardContent>
                </Card>
              </div>

              {/* Users preview */}
              {users.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Usuarios con fotos
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {users.map(u => {
                      const userPhotoCount = photos.filter(p => p.user_id === u.id).length;
                      return (
                        <Badge 
                          key={u.id} 
                          variant="secondary" 
                          className="gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => {
                            setFilterUser(u.id);
                            setViewMode('all');
                          }}
                        >
                          <User className="w-3 h-3" />
                          @{u.nickname}
                          <span className="text-muted-foreground">({userPhotoCount})</span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload button */}
              <Button 
                className="w-full mt-4" 
                size="lg"
                onClick={() => setShowUploadDialog(true)}
              >
                <Camera className="w-5 h-5 mr-2" />
                Subir mis fotos
              </Button>
            </>
          )}
        </div>

        {renderDialogs()}
      </div>
    );
  }

  // ===== GROUPED VIEW =====
  if (viewMode === 'grouped') {
    return (
      <div className="pb-20">
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleBackToSelection} className="h-8 w-8">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Por Usuario</h1>
                <p className="text-xs text-muted-foreground">
                  {users.length} usuarios · {photos.length} fotos
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
                <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
              </Button>
              <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                <Camera className="w-4 h-4 mr-1" />
                Subir
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {(loading || usersLoading) ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(photosByUser).length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-foreground mb-1">Sin fotos aún</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sé el primero en compartir un recuerdo
                </p>
                <Button onClick={() => setShowUploadDialog(true)}>
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Subir Fotos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {Object.entries(photosByUser).map(([userId, userPhotos]) => {
                const isExpanded = expandedUsers.has(userId);
                const displayPhotos = isExpanded ? userPhotos : userPhotos.slice(0, 4);
                const hasMore = userPhotos.length > 4;
                const nickname = getUserNickname(userId);
                
                return (
                  <Card key={userId} className="overflow-hidden">
                    {/* User header */}
                    <div 
                      className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer"
                      onClick={() => toggleUserExpansion(userId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">@{nickname}</h3>
                          <p className="text-xs text-muted-foreground">
                            {userPhotos.length} foto{userPhotos.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        {isExpanded ? 'Ver menos' : hasMore ? `Ver todas (${userPhotos.length})` : 'Ver'}
                      </Button>
                    </div>
                    
                    {/* Photos grid */}
                    <CardContent className="p-2">
                      <div className="grid grid-cols-4 gap-1">
                        {displayPhotos.map((photo, idx) => (
                          <div
                            key={photo.id}
                            className="relative aspect-square rounded overflow-hidden bg-muted cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPhotoDetail(photo);
                            }}
                          >
                            <img
                              src={photo.image_url}
                              alt={photo.caption || 'Foto'}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                            {!isExpanded && idx === 3 && hasMore && (
                              <div 
                                className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleUserExpansion(userId);
                                }}
                              >
                                +{userPhotos.length - 4}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        {renderDialogs()}
      </div>
    );
  }

  // ===== ALL PHOTOS VIEW (default) =====
  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleBackToSelection} className="h-8 w-8">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Galería del Recuerdo</h1>
              <p className="text-xs text-muted-foreground">
                {filteredPhotos.length} de {photos.length} fotos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={showFilters ? "secondary" : "ghost"} 
              size="icon" 
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="w-5 h-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </Button>
            <Button size="sm" onClick={() => setShowUploadDialog(true)}>
              <Camera className="w-4 h-4 mr-1" />
              Subir
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filtros</span>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpiar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Year Filter */}
              <div>
                <Label className="text-xs mb-1 block">Año</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los años</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter */}
              <div>
                <Label className="text-xs mb-1 block">Usuario</Label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {user && (
                      <SelectItem value={user.id}>Mis fotos</SelectItem>
                    )}
                    {users.filter(u => u.id !== user?.id).map(u => (
                      <SelectItem key={u.id} value={u.id}>@{u.nickname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active filters badges */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {filterYear !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {filterYear}
                    <button onClick={() => setFilterYear('all')} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {filterUser !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    <User className="w-3 h-3" />
                    {filterUser === user?.id ? 'Mis fotos' : `@${getUserNickname(filterUser)}`}
                    <button onClick={() => setFilterUser('all')} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gallery Grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPhotos.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Camera className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-1">
                {activeFilterCount > 0 ? 'Sin fotos con estos filtros' : 'Sin fotos aún'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {activeFilterCount > 0 
                  ? 'Prueba ajustando los filtros'
                  : 'Sé el primero en compartir un recuerdo'
                }
              </p>
              {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : (
                <Button onClick={() => setShowUploadDialog(true)}>
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Subir Fotos
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filteredPhotos.map((photo) => renderPhotoCard(photo))}
          </div>
        )}
      </div>

      {renderDialogs()}
    </div>
  );
};
