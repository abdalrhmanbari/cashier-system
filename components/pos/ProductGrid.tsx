'use client';

import { useState, useMemo } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { ProductWithCategory } from '@/types';
import { formatCurrency, calculateDiscountedPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';

interface ProductGridProps {
  products: ProductWithCategory[];
  categories: { id: string; name: string; color: string }[];
}

export function ProductGrid({ products, categories }: ProductGridProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { addItem } = useCartStore();

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? '').includes(search);
      const matchCategory = !activeCategory || p.categoryId === activeCategory;
      return matchSearch && matchCategory && p.isActive;
    });
  }, [products, search, activeCategory]);

  function handleAdd(product: ProductWithCategory) {
    if (product.stock <= 0) return;
    const effectivePrice = product.hasDiscount
      ? calculateDiscountedPrice(product.price, product.discountType as 'PERCENTAGE' | 'FIXED', product.discountValue ?? 0)
      : product.price;

    addItem({
      productId: product.id,
      name: product.name,
      barcode: product.barcode ?? undefined,
      unitPrice: effectivePrice,
      discount: product.hasDiscount ? product.discountValue : 0,
      discountType: (product.discountType ?? 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
      stock: product.stock,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود... (F1)"
            className="w-full ps-9 pe-4 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 p-3 overflow-x-auto border-b border-border">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
            !activeCategory ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          }`}
        >
          الكل
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            style={activeCategory === cat.id
              ? { backgroundColor: cat.color, borderColor: cat.color }
              : { borderColor: undefined }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border-2 ${
              activeCategory === cat.id
                ? 'text-white'
                : 'bg-muted border-transparent hover:bg-muted/80'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">لا توجد منتجات</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filtered.map((product) => {
              const effectivePrice = product.hasDiscount
                ? calculateDiscountedPrice(product.price, product.discountType as 'PERCENTAGE' | 'FIXED', product.discountValue ?? 0)
                : product.price;
              const outOfStock = product.stock <= 0;
              const lowStock = product.stock > 0 && product.stock <= product.minStock;

              return (
                <button
                  key={product.id}
                  onClick={() => handleAdd(product)}
                  disabled={outOfStock}
                  className={`relative text-start p-3 rounded-xl border-2 transition-all ${
                    outOfStock
                      ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                      : 'border-border bg-card hover:border-primary/50 hover:shadow-md active:scale-95 cursor-pointer'
                  }`}
                >
                  {/* Low stock badge */}
                  {lowStock && !outOfStock && (
                    <div className="absolute top-1.5 end-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
                      <span className="text-xs font-bold text-destructive">نفد المخزون</span>
                    </div>
                  )}

                  {/* Category color dot */}
                  {product.category && (
                    <div
                      className="w-1.5 h-1.5 rounded-full mb-2"
                      style={{ backgroundColor: product.category.color }}
                    />
                  )}

                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight mb-1.5">
                    {product.name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    مخزون: {product.stock}
                  </p>

                  <div>
                    {product.hasDiscount && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatCurrency(product.price)}
                      </p>
                    )}
                    <p className={`text-sm font-bold ${product.hasDiscount ? 'text-green-600' : 'text-foreground'}`}>
                      {formatCurrency(effectivePrice)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
