import { ArticleCategory, ArticleStatus } from "@/types";

// Fabric Type options
export const FABRIC_TYPES = [
  { value: 'Larson', label: 'Larson' },
  { value: 'M Saad', label: 'M Saad' },
  { value: 'Clipper', label: 'Clipper' },
  { value: 'Other', label: 'Other' },
];

// Category options
export const CATEGORY_OPTIONS: { value: ArticleCategory; label: string }[] = [
  { value: 'grey_material', label: 'Grey Material' },
  { value: 'packaging_material', label: 'Packaging Material' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'service_item', label: 'Service Item' },
];

// Status options
export const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'Discontinued' },
];

// Reed Pick options - Common textile constructions
export const REED_PICK_OPTIONS = [
  { value: '44x44', label: '44x44' },
  { value: '52x52', label: '52x52' },
  { value: '60x60', label: '60x60' },
  { value: '68x68', label: '68x68' },
  { value: '72x68', label: '72x68' },
  { value: '76x68', label: '76x68' },
  { value: '80x80', label: '80x80' },
  { value: '88x60', label: '88x60' },
  { value: '92x80', label: '92x80' },
  { value: '100x80', label: '100x80' },
  { value: '110x90', label: '110x90' },
  { value: '120x100', label: '120x100' },
  { value: '132x72', label: '132x72' },
  { value: '144x80', label: '144x80' },
];

// Color options - Common textile colors
export const COLOR_OPTIONS = [
  { value: 'White', label: 'White', hex: '#FFFFFF' },
  { value: 'Off White', label: 'Off White', hex: '#FAF9F6' },
  { value: 'Cream', label: 'Cream', hex: '#FFFDD0' },
  { value: 'Beige', label: 'Beige', hex: '#F5F5DC' },
  { value: 'Ivory', label: 'Ivory', hex: '#FFFFF0' },
  { value: 'Black', label: 'Black', hex: '#000000' },
  { value: 'Navy Blue', label: 'Navy Blue', hex: '#000080' },
  { value: 'Royal Blue', label: 'Royal Blue', hex: '#4169E1' },
  { value: 'Sky Blue', label: 'Sky Blue', hex: '#87CEEB' },
  { value: 'Teal', label: 'Teal', hex: '#008080' },
  { value: 'Maroon', label: 'Maroon', hex: '#800000' },
  { value: 'Burgundy', label: 'Burgundy', hex: '#800020' },
  { value: 'Red', label: 'Red', hex: '#FF0000' },
  { value: 'Coral', label: 'Coral', hex: '#FF7F50' },
  { value: 'Pink', label: 'Pink', hex: '#FFC0CB' },
  { value: 'Rose', label: 'Rose', hex: '#FF007F' },
  { value: 'Olive', label: 'Olive', hex: '#808000' },
  { value: 'Forest Green', label: 'Forest Green', hex: '#228B22' },
  { value: 'Sage Green', label: 'Sage Green', hex: '#9DC183' },
  { value: 'Mint', label: 'Mint', hex: '#98FF98' },
  { value: 'Grey', label: 'Grey', hex: '#808080' },
  { value: 'Charcoal', label: 'Charcoal', hex: '#36454F' },
  { value: 'Silver', label: 'Silver', hex: '#C0C0C0' },
  { value: 'Gold', label: 'Gold', hex: '#FFD700' },
  { value: 'Brown', label: 'Brown', hex: '#A52A2A' },
  { value: 'Tan', label: 'Tan', hex: '#D2B48C' },
  { value: 'Khaki', label: 'Khaki', hex: '#F0E68C' },
  { value: 'Purple', label: 'Purple', hex: '#800080' },
  { value: 'Lavender', label: 'Lavender', hex: '#E6E6FA' },
  { value: 'Peach', label: 'Peach', hex: '#FFCBA4' },
  { value: 'Other', label: 'Other (Custom)', hex: '#CCCCCC' },
];
