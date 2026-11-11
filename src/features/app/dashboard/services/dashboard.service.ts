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
  inventoryValue,
  rankProductsByInventoryValue,
  selectEligibleProducts,
  selectProductsForDashboardFilter,
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
      lowStockCount: selectProductsForDashboardFilter(snapshot.products, DashboardFilters.LOW_STOCK, now).length,
      outOfStockCount: selectProductsForDashboardFilter(snapshot.products, DashboardFilters.OUT_OF_STOCK, now).length,
      hiddenCount: snapshot.allProducts.filter((product) => product.is_hidden).length,
      noImageCount: selectProductsForDashboardFilter(snapshot.products, DashboardFilters.NO_IMAGE, now).length,
      noPriceCount: selectProductsForDashboardFilter(snapshot.products, DashboardFilters.NO_PRICE, now).length,
      urgentPurchaseCount: selectProductsForDashboardFilter(snapshot.products, DashboardFilters.URGENT_PURCHASE, now).length,
      addedTodayCount: selectProductsForDashboardFilter(snapshot.products, DashboardFilters.TODAY, now).length,
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
      case DashboardFilters.TODAY:
        return { title: "محصولات افزوده‌شده امروز", products: selectProductsForDashboardFilter(products, filter) };
      case DashboardFilters.INVENTORY_VALUE:
        return { title: "ارزش موجودی", products: selectProductsForDashboardFilter(products, filter) };
      case DashboardFilters.LOW_STOCK:
        return { title: "کالاهای دچار کمبود", products: selectProductsForDashboardFilter(products, filter) };
      case DashboardFilters.OUT_OF_STOCK:
        return { title: "کالاهای ناموجود", products: selectProductsForDashboardFilter(products, filter) };
      case DashboardFilters.HIDDEN:
        return { title: "کالاهای مخفی", products: allProducts.filter((product) => product.is_hidden) };
      case DashboardFilters.NO_IMAGE:
        return { title: "کالاهای بدون تصویر", products: selectProductsForDashboardFilter(products, filter) };
      case DashboardFilters.NO_PRICE:
        return { title: "کالاهای بدون قیمت", products: selectProductsForDashboardFilter(products, filter) };
      case DashboardFilters.URGENT_PURCHASE:
        return {
          title: "نیازمند خرید فوری",
          products: selectProductsForDashboardFilter(products, filter),
        };
      default:
        return { title: "", products: [] };
    }
  }
}

export const dashboardService = new DashboardService();
