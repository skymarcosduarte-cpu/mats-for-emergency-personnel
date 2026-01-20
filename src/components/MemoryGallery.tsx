// Memory Gallery Component - "Galería del Recuerdo"
// Displays community nostalgic photos with likes, comments, and date

import React, { useState, useRef, useEffect } from 'react';
import { 
  ImagePlus, Loader2, Trash2, X, Upload, Camera, 
  ArrowLeft, RefreshCw, ZoomIn, Heart, MessageCircle, Calendar, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageGalleryViewer } from '@/components/ImageGalleryViewer';
import { useMemoryGallery, MemoryPhoto, PhotoComment } from '@/hooks/useMemoryGallery';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MemoryGalleryProps {
  onBack: () => void;
}

export const MemoryGallery: React.FC<MemoryGalleryProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { 
    photos, loading, uploading, uploadPhotos, deletePhoto, 
    toggleLike, getComments, addComment, deleteComment, refresh 
  } = useMemoryGallery();
  
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [photoDate, setPhotoDate] = useState('');
  const [viewerImages, setViewerImages] = useState<{ images: string[]; index: number } | null>(null);
  
  // Photo detail/comments dialog
  const [selectedPhoto, setSelectedPhoto] = useState<MemoryPhoto | null>(null);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Refresh comments
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
    const allImages = photos.map(p => p.image_url);
    setViewerImages({ images: allImages, index });
  };

  const openPhotoDetail = (photo: MemoryPhoto) => {
    setSelectedPhoto(photo);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Galería del Recuerdo</h1>
              <p className="text-xs text-muted-foreground">{photos.length} fotos</p>
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

      {/* Gallery Grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo, index) => (
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
            ))}
          </div>
        )}
      </div>

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
                  onClick={() => openViewer(photos.findIndex(p => p.id === selectedPhoto.id))}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => openViewer(photos.findIndex(p => p.id === selectedPhoto.id))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-4 space-y-4">
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
                  {selectedPhoto.user_id === user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedPhoto)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
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
    </div>
  );
};
