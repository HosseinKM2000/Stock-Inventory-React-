import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import {
  DashboardFilters,
  type DashboardFilter,
  type DashboardProductList,
  type DashboardStats,
} from "../types";

class DashboardService {
  private hasImage(image?: string | null) {
    return image != null && image !== "";
  }
  async getStats(): Promise<DashboardStats> {
    const products = await inventoryService.getAll({ include_hidden: true });
    const now = new Date();

    return {
      totalProducts: products.length,

      inventoryValue: products.reduce(
        (sum, product) => sum + product.quantity * product.price,
        0,
      ),

      lowStockCount: products.filter(
        (product) => product.status === "low_stock",
      ).length,

      outOfStockCount: products.filter(
        (product) => product.status === "out_of_stock",
      ).length,

      hiddenCount: products.filter((product) => product.is_hidden).length,

      noImageCount: products.filter(
        (product) => !this.hasImage(product.image_url),
      ).length,

      noPriceCount: products.filter((product) => product.price <= 0).length,

      urgentPurchaseCount: products.filter(
        (product) =>
          product.low_stock_alert &&
          product.quantity <= product.low_stock_threshold,
      ).length,

      addedTodayCount: products.filter((product) =>
        this.isSameLocalDate(product.created_at, now),
      ).length,
    };
  }

  private isSameLocalDate(value: string, date: Date): boolean {
    const createdAt = new Date(value);
    return (
      !Number.isNaN(createdAt.getTime()) &&
      createdAt.getFullYear() === date.getFullYear() &&
      createdAt.getMonth() === date.getMonth() &&
      createdAt.getDate() === date.getDate()
    );
  }

  async getProducts(filter: DashboardFilter): Promise<DashboardProductList> {
    const allProducts = await inventoryService.getAll({ include_hidden: true });
    const products = allProducts.filter((product) => !product.is_hidden);

    switch (filter) {
      case DashboardFilters.LOW_STOCK:
        return {
          title: "کالاهای کم موجود",
          products: products.filter(
            (product) => product.status === "low_stock",
          ),
        };

      case DashboardFilters.OUT_OF_STOCK:
        return {
          title: "کالاهای ناموجود",
          products: products.filter(
            (product) => product.status === "out_of_stock",
          ),
        };

      case DashboardFilters.HIDDEN:
        return {
          title: "کالاهای مخفی",
          products: allProducts.filter((product) => product.is_hidden),
        };

      case DashboardFilters.NO_IMAGE:
        return {
          title: "کالاهای بدون تصویر",
          products: products.filter(
            (product) => !this.hasImage(product.image_url),
          ),
        };

      case DashboardFilters.NO_PRICE:
        return {
          title: "کالاهای بدون قیمت",
          products: products.filter((product) => product.price <= 0),
        };

      case DashboardFilters.URGENT_PURCHASE:
        return {
          title: "نیازمند خرید فوری",
          products: products.filter(
            (product) =>
              product.low_stock_alert &&
              product.quantity <= product.low_stock_threshold,
          ),
        };

      default:
        return {
          title: "",
          products: [],
        };
    }
  }
}

export const dashboardService = new DashboardService();
