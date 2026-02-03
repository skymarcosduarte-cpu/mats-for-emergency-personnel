// Job Board Screen - Bolsa de Trabajo
// Users can post CVs and job opportunities
import React, { useState } from 'react';
import {
  Briefcase, Plus, FileText, User, Award, Target, Loader2,
  ArrowLeft, RefreshCw, Trash2, Edit, Download, Building2, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useJobBoard, JobPost, CreateJobPostData } from '@/hooks/useJobBoard';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface JobBoardScreenProps {
  onBack: () => void;
}

export const JobBoardScreen: React.FC<JobBoardScreenProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { posts, loading, myPost, createPost, updatePost, deletePost, refresh } = useJobBoard();
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<JobPost | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'seeking' | 'offering'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState<CreateJobPostData>({
    full_name: '',
    title: '',
    experience: '',
    position_sought: '',
    is_offering_job: false,
  });
  const [cvFile, setCvFile] = useState<File | null>(null);

  const resetForm = () => {
    setFormData({
      full_name: '',
      title: '',
      experience: '',
      position_sought: '',
      is_offering_job: false,
    });
    setCvFile(null);
    setEditingPost(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (post: JobPost) => {
    setEditingPost(post);
    setFormData({
      full_name: post.full_name,
      title: post.title,
      experience: post.experience || '',
      position_sought: post.position_sought,
      is_offering_job: post.is_offering_job,
    });
    setCvFile(null);
    setShowDialog(true);
  };

  const handleDelete = async (post: JobPost) => {
    if (!confirm('¿Eliminar esta publicación?')) return;
    try {
      await deletePost(post.id);
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo debe ser menor a 10MB');
      return;
    }

    setCvFile(file);
  };

  const handleSubmit = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Ingresa tu nombre');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Ingresa tu título profesional');
      return;
    }
    if (!formData.position_sought.trim()) {
      toast.error('Ingresa el puesto buscado/ofrecido');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPost) {
        await updatePost(editingPost.id, formData, cvFile || undefined);
      } else {
        await createPost(formData, cvFile || undefined);
      }
      setShowDialog(false);
      resetForm();
    } catch (err: any) {
      console.error('Error saving post:', err);
      toast.error(err?.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter posts
  const filteredPosts = posts.filter(post => {
    // Filter by type
    if (filter === 'seeking' && post.is_offering_job) return false;
    if (filter === 'offering' && !post.is_offering_job) return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        post.full_name.toLowerCase().includes(query) ||
        post.title.toLowerCase().includes(query) ||
        post.position_sought.toLowerCase().includes(query) ||
        (post.experience?.toLowerCase().includes(query) || false)
      );
    }

    return true;
  });

  return (
    <div className="flex-1 overflow-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Bolsa de Trabajo</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </Button>
            <Button size="sm" onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-1" />
              Publicar
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, título o puesto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="flex-1"
            >
              Todos
            </Button>
            <Button
              variant={filter === 'seeking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('seeking')}
              className="flex-1"
            >
              <User className="w-4 h-4 mr-1" />
              Buscan trabajo
            </Button>
            <Button
              variant={filter === 'offering' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('offering')}
              className="flex-1"
            >
              <Building2 className="w-4 h-4 mr-1" />
              Ofertas
            </Button>
          </div>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No se encontraron resultados' : 'No hay publicaciones aún'}
              </p>
              <Button className="mt-4" onClick={handleOpenNew}>
                <Plus className="w-4 h-4 mr-1" />
                Crear primera publicación
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className={cn(
                  'overflow-hidden transition-all',
                  post.user_id === user?.id && 'border-primary/40 bg-primary/5'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar/Icon */}
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                      post.is_offering_job
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    )}>
                      {post.is_offering_job ? (
                        <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{post.full_name}</h3>
                        <Badge
                          variant={post.is_offering_job ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs',
                            post.is_offering_job 
                              ? 'bg-emerald-600 hover:bg-emerald-700' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          )}
                        >
                          {post.is_offering_job ? 'Ofrece empleo' : 'Busca empleo'}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        {post.title}
                      </p>

                      <p className="text-sm font-medium text-primary mt-1 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        {post.position_sought}
                      </p>

                      {post.experience && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {post.experience}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {post.cv_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-8"
                          >
                            <a href={post.cv_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-3.5 h-3.5 mr-1" />
                              {post.cv_filename || 'Ver CV'}
                            </a>
                          </Button>
                        )}

                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
                        </span>
                      </div>
                    </div>

                    {/* Actions (only for own posts) */}
                    {post.user_id === user?.id && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(post)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(post)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              {editingPost ? 'Editar Publicación' : 'Nueva Publicación'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label>¿Qué deseas publicar?</Label>
              <Select
                value={formData.is_offering_job ? 'offering' : 'seeking'}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, is_offering_job: value === 'offering' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seeking">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Busco trabajo
                    </div>
                  </SelectItem>
                  <SelectItem value="offering">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Ofrezco empleo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo *</Label>
              <Input
                id="full_name"
                placeholder="Tu nombre o nombre de la empresa"
                value={formData.full_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título profesional *</Label>
              <Input
                id="title"
                placeholder="Ej: Ingeniero de Sistemas, Contador, etc."
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            {/* Position Sought */}
            <div className="space-y-2">
              <Label htmlFor="position_sought">
                {formData.is_offering_job ? 'Puesto ofrecido *' : 'Puesto buscado *'}
              </Label>
              <Input
                id="position_sought"
                placeholder={formData.is_offering_job 
                  ? 'Ej: Analista de Datos, Gerente de Ventas' 
                  : 'Ej: Desarrollador Frontend, Asistente Administrativo'
                }
                value={formData.position_sought}
                onChange={(e) => setFormData((prev) => ({ ...prev, position_sought: e.target.value }))}
              />
            </div>

            {/* Experience */}
            <div className="space-y-2">
              <Label htmlFor="experience">
                {formData.is_offering_job ? 'Descripción del puesto' : 'Experiencia'}
              </Label>
              <Textarea
                id="experience"
                placeholder={formData.is_offering_job 
                  ? 'Describe las responsabilidades y requisitos...' 
                  : 'Describe brevemente tu experiencia laboral...'
                }
                value={formData.experience}
                onChange={(e) => setFormData((prev) => ({ ...prev, experience: e.target.value }))}
                rows={3}
              />
            </div>

            {/* CV Upload */}
            <div className="space-y-2">
              <Label htmlFor="cv">
                {formData.is_offering_job ? 'Documento adicional (PDF, DOC)' : 'Curriculum Vitae (PDF, DOC)'}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cv"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
              </div>
              {cvFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {cvFile.name}
                </p>
              )}
              {editingPost?.cv_filename && !cvFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Archivo actual: {editingPost.cv_filename}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingPost ? 'Guardar cambios' : 'Publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobBoardScreen;
