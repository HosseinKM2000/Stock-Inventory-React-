import { catalogVisibilityService } from "@/features/app/inventory/services/catalog-visibility.service";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { labelStorage } from "@/shared/lib/infrastructure/storage/label-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import {
  DashboardFilters,
  type DashboardAnalysis,
  type DashboardFilter,
  type DashboardProductList,
  type DashboardStats,
} from "../types";
import {
  aggregateCategoriesByInventoryValue,
  buildTodayActions,
  classifyProducts,
  hasMissingPrice,
  inventoryValue,
  rankProductsByInventoryValue,
  selectEligibleProducts,
} from "./dashboard-selectors";

async function localSnapshot() {
  const [allProducts, categories, labels, queue] = await Promise.all([
    inventoryService.getAll({ include_hidden: true }),
    categoryStorage.getAll(),
    labelStorage.getAll(),
    queueService.getAll(),
  ]);
  const products = selectEligibleProducts(
    allProducts,
    catalogVisibilityService.isHidden(),
  );
  return { allProducts, products, categories, labels, queue };
}

class DashboardService {
  private hasImage(product: Awaited<ReturnType<typeof inventoryService.getAll>>[number]) {
    return Boolean(product.image_url?.trim() || product.catalog_product?.image_url?.trim());
  }

  private isSameLocalDate(value: string, date: Date): boolean {
    const createdAt = new Date(value);
    return !Number.isNaN(createdAt.getTime()) &&
      createdAt.getFullYear() === date.getFullYear() &&
      createdAt.getMonth() === date.getMonth() &&
      createdAt.getDate() === date.getDate();
  }

  async getAnalysis(): Promise<DashboardAnalysis> {
    const snapshot = await localSnapshot();
    const classification = classifyProducts(
      snapshot.products,
      snapshot.categories,
      snapshot.labels,
    );
    const categoryAggregation = aggregateCategoriesByInventoryValue(
      snapshot.products,
      snapshot.categories,
    );
    return {
      products: snapshot.products,
      productValues: rankProductsByInventoryValue(snapshot.products),
      categoryValues: categoryAggregation.categories,
      excludedUncategorizedValue: categoryAggregation.excludedUncategorizedValue,
      missingPriceCount: categoryAggregation.missingPriceCount,
      classification,
      actions: buildTodayActions(snapshot.products, classification, snapshot.queue),
    };
  }

  async getStats(): Promise<DashboardStats> {
    const snapshot = await localSnapshot();
    const classification = classifyProducts(
      snapshot.products,
      snapshot.categories,
      snapshot.labels,
    );
    const actions = buildTodayActions(snapshot.products, classification, snapshot.queue);
    const now = new Date();

    return {
      totalProducts: snapshot.products.length,
      inventoryValue: snapshot.products.reduce((sum, product) => {
        const value = inventoryValue(product);
        return value === null || !Number.isSafeInteger(sum + value) ? sum : sum + value;
      }, 0),
      lowStockCount: snapshot.products.filter((product) => product.status === "low_stock").length,
      outOfStockCount: snapshot.products.filter((product) => product.status === "out_of_stock").length,
      hiddenCount: snapshot.allProducts.filter((product) => product.is_hidden).length,
      noImageCount: snapshot.products.filter((product) => !this.hasImage(product)).length,
      noPriceCount: snapshot.products.filter(hasMissingPrice).length,
      urgentPurchaseCount: snapshot.products.filter((product) =>
        product.low_stock_alert && product.quantity <= product.low_stock_threshold,
      ).length,
      addedTodayCount: snapshot.products.filter((product) =>
        this.isSameLocalDate(product.created_at, now),
      ).length,
      missingClassificationCount: classification.distinctCount,
      valuedProductsCount: rankProductsByInventoryValue(
        snapshot.products,
        Number.MAX_SAFE_INTEGER,
      ).length,
      todayActionCount: actions.inventory.length + (actions.sync ? 1 : 0),
    };
  }

  async getProducts(filter: DashboardFilter): Promise<DashboardProductList> {
    const allProducts = await inventoryService.getAll({ include_hidden: true });
    const products = selectEligibleProducts(
      allProducts,
      catalogVisibilityService.isHidden(),
    );

    switch (filter) {
      case DashboardFilters.ALL:
        return { title: "مجموع کالاها", products };
      case DashboardFilters.TODAY: {
        const now = new Date();
        return {
          title: "محصولات افزوده‌شده امروز",
          products: products.filter((product) => this.isSameLocalDate(product.created_at, now)),
        };
      }
      case DashboardFilters.INVENTORY_VALUE:
        return { title: "ارزش موجودی", products };
      case DashboardFilters.LOW_STOCK:
        return { title: "کالاهای کم موجود", products: products.filter((product) => product.status === "low_stock") };
      case DashboardFilters.OUT_OF_STOCK:
        return { title: "کالاهای ناموجود", products: products.filter((product) => product.status === "out_of_stock") };
      case DashboardFilters.HIDDEN:
        return { title: "کالاهای مخفی", products: allProducts.filter((product) => product.is_hidden) };
      case DashboardFilters.NO_IMAGE:
        return { title: "کالاهای بدون تصویر", products: products.filter((product) => !this.hasImage(product)) };
      case DashboardFilters.NO_PRICE:
        return { title: "کالاهای بدون قیمت", products: products.filter(hasMissingPrice) };
      case DashboardFilters.URGENT_PURCHASE:
        return {
          title: "نیازمند خرید فوری",
          products: products.filter((product) =>
            product.low_stock_alert && product.quantity <= product.low_stock_threshold,
          ),
        };
      default:
        return { title: "", products: [] };
    }
  }
}

export const dashboardService = new DashboardService();
