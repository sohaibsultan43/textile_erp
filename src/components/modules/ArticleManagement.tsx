import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { getCurrentUser } from '@/lib/auth';
import { FABRIC_TYPES, COLOR_OPTIONS, CATEGORY_OPTIONS, STATUS_OPTIONS, REED_PICK_OPTIONS } from '@/lib/constants';
import { Article, ArticleCategory, ArticleStatus, UserRole, User } from '@/types';
import { articleApi } from '@/lib/api/articles';
import { Plus, Edit2, Package, Layers, Tag, DollarSign, FileText, Search, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ArticleManagementProps {
  userRole: UserRole;
}


// All fields visible for all categories
const getFieldVisibility = (_category: ArticleCategory) => ({
  fabricType: true,
  color: true,
  grade: true,
  lotNumber: true,
  dimensions: true,
  cost: true,
  salePrice: true,
});

interface FormData {
  name: string;
  category: ArticleCategory;
  status: ArticleStatus;
  fabricType: string;
  color: string;
  grade: 'A' | 'B' | 'C' | '';
  lotNumber: string;
  unit: string;
  cost: string;
  salePrice: string;
  yarnCount: string; // Yarn count (e.g. 40pv 40 pv)
  composition: string; // Composition (e.g. 80:20)
  constraction: string; // Constraction (e.g. 112 90)
  width: string; // Width (e.g. 50")
  remarks: string;
}

const initialFormData: FormData = {
  name: '',
  category: 'grey_material',
  status: 'active',
  fabricType: 'Other',
  color: '',
  grade: '',
  lotNumber: '',
  unit: 'Meter',
  cost: '',
  salePrice: '',
  yarnCount: '',
  composition: '',
  constraction: '',
  width: '',
  remarks: '',
};

export const ArticleManagement = ({ userRole }: ArticleManagementProps) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get field visibility based on selected category
  const fieldVisibility = useMemo(() => getFieldVisibility(formData.category), [formData.category]);

  useEffect(() => {
    loadArticles();
    loadUsers();
  }, []);

  const loadUsers = () => {
    const storedUsers = storage.get<User>(STORAGE_KEYS.USERS);
    setUsers(storedUsers);
  };

  const getCreatorName = (createdBy?: string) => {
    if (!createdBy) return '-';
    const user = users.find(u => u.id === createdBy);
    return user?.name || 'Unknown';
  };

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      const apiArticles = await articleApi.getAll();
      const normalizedArticles = apiArticles.map(article => ({
        ...article,
        category: article.category || 'grey_material',
        status: article.status || 'active',
        unit: article.unit || 'Meter',
        cost: article.cost || 0,
        salePrice: article.salePrice || 0,
      })) as Article[];

      setArticles(normalizedArticles);
    } catch (error) {
      console.error('Error loading articles:', error);
      toast.error('Failed to load articles. Please check your connection and try again.');
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredArticles = useMemo(() => {
    if (!searchQuery) return articles;
    const query = searchQuery.toLowerCase();
    return articles.filter(article =>
      article.name.toLowerCase().includes(query) ||
      article.fabricType?.toLowerCase().includes(query) ||
      article.color?.toLowerCase().includes(query)
    );
  }, [articles, searchQuery]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingArticle(null);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setFormData({
      name: article.name,
      category: article.category || 'grey_material',
      status: article.status || 'active',
      fabricType: article.fabricType || 'Other',
      color: article.color || '',
      grade: article.grade || '',
      lotNumber: article.lotNumber || '',
      unit: article.unit || 'Meter',
      cost: article.cost?.toString() || '',
      salePrice: article.salePrice?.toString() || '',
      yarnCount: article.yarnCount || '',
      composition: article.composition || '',
      constraction: article.constraction || '',
      width: article.width || '',
      remarks: article.remarks || '',
    });
    setIsDialogOpen(true);
  };

  const handleCategoryChange = (category: ArticleCategory) => {
    const visibility = getFieldVisibility(category);
    setFormData(prev => ({
      ...prev,
      category,
      fabricType: visibility.fabricType ? (prev.fabricType || 'Other') : '',
      color: visibility.color ? prev.color : '',
      grade: visibility.grade ? prev.grade : '',
      lotNumber: visibility.lotNumber ? prev.lotNumber : '',
      yarnCount: visibility.dimensions ? prev.yarnCount : '',
      composition: visibility.dimensions ? prev.composition : '',
      constraction: visibility.dimensions ? prev.constraction : '',
      width: visibility.dimensions ? prev.width : '',
      cost: visibility.cost ? prev.cost : '',
      salePrice: visibility.salePrice ? prev.salePrice : '',
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Article name is required');
      return;
    }

    if (!formData.category) {
      toast.error('Article category is required');
      return;
    }

    if (!formData.unit) {
      toast.error('Unit is required');
      return;
    }

    if (formData.category === 'finished_goods') {
      if (!formData.fabricType) {
        toast.error('Fabric type is required for Finished Goods');
        return;
      }
      if (!formData.color) {
        toast.error('Color is required for Finished Goods');
        return;
      }
    }

    const existingArticle = articles.find(
      a => a.name.toLowerCase() === formData.name.toLowerCase() && a.id !== editingArticle?.id
    );
    if (existingArticle) {
      toast.error('Article with this name already exists');
      return;
    }

    const cost = formData.cost ? parseFloat(formData.cost) : undefined;
    const salePrice = formData.salePrice ? parseFloat(formData.salePrice) : undefined;

    setIsLoading(true);
    try {
      const articleData = {
        name: formData.name,
        category: formData.category,
        status: formData.status,
        fabricType: formData.fabricType || '',
        color: formData.color || undefined,
        grade: formData.grade || undefined,
        lotNumber: formData.lotNumber || undefined,
        unit: formData.unit,
        cost,
        salePrice,
        yarnCount: formData.yarnCount || undefined,
        composition: formData.composition || undefined,
        constraction: formData.constraction || undefined,
        width: formData.width || undefined,
        remarks: formData.remarks || undefined,
      };

      if (editingArticle) {
        const updatedArticle = await articleApi.update(editingArticle.id, articleData);
        toast.success('Article updated successfully');
      } else {
        const currentUser = getCurrentUser();
        await articleApi.create({
          ...articleData,
          createdBy: currentUser?.id,
        });
        toast.success('Article created successfully');
      }

      await loadArticles();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      console.error('Error saving article:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save article: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const canModify = userRole === 'owner' || userRole === 'warehouse' || userRole === 'purchase_officer';

  const getCategoryBadgeVariant = (category: ArticleCategory): "default" | "secondary" | "destructive" | "outline" => {
    switch (category) {
      case 'grey_material':
        return 'secondary';
      case 'packaging_material':
        return 'outline';
      case 'finished_goods':
        return 'default';
      case 'service_item':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: ArticleStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'discontinued':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getCategoryLabel = (category: ArticleCategory) => {
    return CATEGORY_OPTIONS.find(c => c.value === category)?.label || category;
  };

  // Stats
  const stats = useMemo(() => ({
    total: articles.length,
    active: articles.filter(a => a.status === 'active').length,
    finishedGoods: articles.filter(a => a.category === 'finished_goods').length,
    greyMaterial: articles.filter(a => a.category === 'grey_material').length,
  }), [articles]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finished Goods</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.finishedGoods}</div>
          </CardContent>
        </Card>
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grey Material</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.greyMaterial}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Article Management</CardTitle>
              <CardDescription>Manage textile articles, materials, and services</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  className="pl-8 w-full sm:w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {canModify && (
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Article
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingArticle ? 'Edit Article' : 'Add New Article'}</DialogTitle>
                      <DialogDescription>
                        {editingArticle ? 'Update article details' : 'Create a new article. Fields adjust based on category.'}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-12 gap-4 py-4">
                      {/* Left Column - Basic Info */}
                      <div className="col-span-12 md:col-span-6 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-400">
                          <Package className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold text-sm">Basic Information</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs">Article Name <span className="text-destructive">*</span></Label>
                            <Input
                              className="border-gray-400"
                              placeholder="e.g., Dilkash"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Category <span className="text-destructive">*</span></Label>
                            <Select value={formData.category} onValueChange={(v) => handleCategoryChange(v as ArticleCategory)}>
                              <SelectTrigger className="border-gray-400">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORY_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Status</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as ArticleStatus })}>
                              <SelectTrigger className="border-gray-400">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Unit <span className="text-destructive">*</span></Label>
                            <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                              <SelectTrigger className="border-gray-400">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Meter">Meter</SelectItem>
                                <SelectItem value="Yard">Yard</SelectItem>
                                <SelectItem value="Piece">Piece</SelectItem>
                                <SelectItem value="Roll">Roll</SelectItem>
                                <SelectItem value="Kg">Kg</SelectItem>
                                <SelectItem value="Box">Box</SelectItem>
                                <SelectItem value="Service">Service</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {fieldVisibility.dimensions && (
                            <div className="col-span-2 space-y-3 pt-2">
                              <div className="flex items-center gap-2 pb-2 border-b border-gray-400">
                                <Tag className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold text-sm">Configuration</h4>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">constraction</Label>
                                  <Input
                                    className="border-gray-400"
                                    value={formData.constraction}
                                    onChange={(e) => setFormData({ ...formData, constraction: e.target.value })}
                                    placeholder="e.g. 112x90"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Yarn count</Label>
                                  <Input
                                    className="border-gray-400"
                                    value={formData.yarnCount}
                                    onChange={(e) => setFormData({ ...formData, yarnCount: e.target.value })}
                                    placeholder="e.g. 40pv"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Width</Label>
                                  <Input
                                    className="border-gray-400"
                                    value={formData.width}
                                    onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                                    placeholder="e.g. 50&quot;"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Composition</Label>
                                  <Input
                                    className="border-gray-400"
                                    value={formData.composition}
                                    onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                                    placeholder="e.g. 80:20"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Right Column - Category Specific Fields */}
                      <div className="col-span-12 md:col-span-6 space-y-4 transition-all duration-300 ease-in-out">
                        {/* Fabric Details - Only show for finished_goods */}
                        {(fieldVisibility.fabricType || fieldVisibility.color || fieldVisibility.grade) && (
                          <div className="space-y-3 animate-in fade-in-50 duration-300">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-400">
                              <Layers className="h-4 w-4 text-primary" />
                              <h4 className="font-semibold text-sm">Fabric Details</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Fabric Type {formData.category === 'finished_goods' && <span className="text-destructive">*</span>}</Label>
                                <Select value={formData.fabricType} onValueChange={(v) => setFormData({ ...formData, fabricType: v })}>
                                  <SelectTrigger className="border-gray-400">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FABRIC_TYPES.map(option => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Color {formData.category === 'finished_goods' && <span className="text-destructive">*</span>}</Label>
                                <Select value={formData.color} onValueChange={(v) => setFormData({ ...formData, color: v })}>
                                  <SelectTrigger className="border-gray-400">
                                    <SelectValue placeholder="Select color" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COLOR_OPTIONS.map(option => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-4 h-4 rounded-full border border-gray-400 flex-shrink-0"
                                            style={{ backgroundColor: option.hex }}
                                          />
                                          <span>{option.label}</span>
                                          <span className="text-xs text-muted-foreground font-mono">{option.hex}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Grade</Label>
                                <Select value={formData.grade} onValueChange={(v) => setFormData({ ...formData, grade: v as 'A' | 'B' | 'C' })}>
                                  <SelectTrigger className="border-gray-400">
                                    <SelectValue placeholder="Select grade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="A">Grade A</SelectItem>
                                    <SelectItem value="B">Grade B</SelectItem>
                                    <SelectItem value="C">Grade C</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Lot Number</Label>
                                <Input
                                  className="border-gray-400"
                                  placeholder="e.g., LOT-2024-001"
                                  value={formData.lotNumber}
                                  onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pricing */}
                        {(fieldVisibility.cost || fieldVisibility.salePrice) && (
                          <div className="space-y-3 animate-in fade-in-50 duration-300">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-400">
                              <DollarSign className="h-4 w-4 text-primary" />
                              <h4 className="font-semibold text-sm">Pricing</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {fieldVisibility.cost && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Cost (PKR)</Label>
                                  <Input
                                    className="border-gray-400"
                                    type="number"
                                    min="0"
                                    placeholder="850"
                                    value={formData.cost}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || parseFloat(value) >= 0) {
                                        setFormData({ ...formData, cost: value });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === '-' || e.key === 'e') e.preventDefault();
                                    }}
                                  />
                                </div>
                              )}
                              {fieldVisibility.salePrice && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Sale Price (PKR)</Label>
                                  <Input
                                    className="border-gray-400"
                                    type="number"
                                    min="0"
                                    placeholder="1200"
                                    value={formData.salePrice}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || parseFloat(value) >= 0) {
                                        setFormData({ ...formData, salePrice: value });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === '-' || e.key === 'e') e.preventDefault();
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Show placeholder when no category-specific fields */}
                        {!fieldVisibility.fabricType && !fieldVisibility.color && !fieldVisibility.grade && !fieldVisibility.cost && !fieldVisibility.salePrice && (
                          <div className="flex items-center justify-center h-32 border border-gray-400 rounded-lg bg-muted/30 animate-in fade-in-50 duration-300">
                            <p className="text-sm text-muted-foreground">No additional fields for this category</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes Section - Full Width */}
                    <div className="space-y-3 pb-4">
                      <div className="flex items-center gap-1 pb-3 border-b border-gray-400">
                        <FileText className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">Notes</h4>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Remarks / Comments</Label>
                        <Textarea
                          placeholder="Internal notes..."
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          className="resize-none min-h-[72px] border-gray-400"
                          rows={3}
                        />
                      </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 border-t border-gray-400 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit}>
                        {editingArticle ? 'Update Article' : 'Create Article'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table className="w-full table-fixed text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[12%]">Name</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[9%]">Category</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[24%]">Reed Pick</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[7%]">Status</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[7%]">Fabric</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[6%]">Color</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[6%]">Grade</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[5%]">Unit</TableHead>
                  <TableHead className="font-semibold h-8 px-2 text-right whitespace-nowrap w-[5%]">Cost</TableHead>
                  <TableHead className="font-semibold h-8 px-2 text-right whitespace-nowrap w-[7%]">Sale</TableHead>
                  <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[7%]">Created</TableHead>
                  {canModify && <TableHead className="font-semibold h-8 px-2 whitespace-nowrap w-[5%]">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canModify ? 12 : 11} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Package className="h-8 w-8" />
                        <span>{searchQuery ? 'No articles match your search' : 'No articles found'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArticles.map(article => {
                    const cost = article.cost || 0;
                    const salePrice = article.salePrice || 0;
                    return (
                      <TableRow key={article.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium whitespace-nowrap px-2 py-2 truncate">{article.name}</TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge variant={getCategoryBadgeVariant(article.category)} className="whitespace-nowrap text-[11px] px-2 py-0">
                            {getCategoryLabel(article.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="w-full max-w-full whitespace-normal break-all leading-5 overflow-hidden">
                            {(article.constraction || article.yarnCount || article.composition || article.width) ? (
                              <span className="inline-block w-full font-mono text-muted-foreground text-[11px] whitespace-normal break-all">
                                {article.constraction || '-'} <span className="text-primary font-bold">/</span> {article.yarnCount || '-'} <span className="text-primary font-bold">/</span> {article.width || '-'} <span className="text-primary font-bold">/</span> {article.composition || '-'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge variant={getStatusBadgeVariant(article.status)} className="whitespace-nowrap text-[11px] px-2 py-0">
                            {article.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap px-2 py-2 truncate">{article.fabricType || '-'}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap px-2 py-2 truncate">{article.color || '-'}</TableCell>
                        <TableCell className="px-2 py-2">
                          {article.grade ? (
                            <Badge variant="outline" className="whitespace-nowrap text-[11px] px-2 py-0">Grade {article.grade}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-2">{article.unit || 'Meter'}</TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap px-2 py-2">
                          {cost > 0 ? `PKR ${cost.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap px-2 py-2">
                          {salePrice > 0 ? `PKR ${salePrice.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{getCreatorName(article.createdBy)}</span>
                          </div>
                        </TableCell>
                        {canModify && (
                          <TableCell className="px-2 py-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(article)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
