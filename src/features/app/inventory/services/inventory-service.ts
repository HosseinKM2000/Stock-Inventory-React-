import { inventoryRepository } from "./inventory.repository";

import type { Product, ProductInput, ProductListParams } from "../types";

class InventoryService {
  async getAll(params: ProductListParams = {}): Promise<Product[]> {
    let products = await inventoryRepository.getAll();

    // Search
    if (params.search) {
      const search = params.search.trim().toLowerCase();

      products = products.filter((product) => {
        const name = product.catalog_product?.name?.toLowerCase() ?? "";

        const label = product.custom_label?.toLowerCase() ?? "";

        return name.includes(search) || label.includes(search);
      });
    }

    // Sort
    if (params.sort) {
      products = [...products].sort((a, b) => {
        switch (params.sort) {
          case "newest":
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );

          case "oldest":
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            );

          case "price_high":
            return b.price - a.price;

          case "price_low":
            return a.price - b.price;

          case "quantity_high":
            return b.quantity - a.quantity;

          case "quantity_low":
            return a.quantity - b.quantity;

          default:
            return 0;
        }
      });
    }

    return products;
  }

  async get(id: number): Promise<Product | undefined> {
    return inventoryRepository.get(id);
  }

  async create(product: Product): Promise<Product> {
    
    await inventoryRepository.save(product);

    const saved = await inventoryRepository.get(product.id);
    if (!saved) {
      throw new Error("product was not saved");
    }

    return saved;
  }

  async update(id: number, input: ProductInput): Promise<Product> {
    const current = await inventoryRepository.get(id);

    if (!current) {
      throw new Error("product not found");
    }

    const updated: Product = {
      ...current,

      ...input,

      updated_at: new Date().toISOString(),
    };

    await inventoryRepository.save(updated);

    const saved = await inventoryRepository.get(id);

    if (!saved) {
      throw new Error("update failed");
    }

    return saved;
  }

  async remove(id: number): Promise<void> {
    await inventoryRepository.remove(id);
  }
}

export const inventoryService = new InventoryService();
