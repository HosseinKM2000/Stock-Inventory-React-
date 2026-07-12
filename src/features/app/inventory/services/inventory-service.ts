import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";

import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../api/products.api";

import { inventoryRepository } from "./inventory.repository";

import type { Product, ProductInput } from "../types";

class InventoryService {
  async getAll() {
    const local = await inventoryRepository.getAll();

    if (local.length) {
      return local;
    }

    const response = await listProducts();

    await inventoryRepository.saveMany(response.items);

    return response.items;
  }
  async get(id: number): Promise<Product | undefined> {
    // 1. اول Local Storage
    const local = await inventoryRepository.get(id);

    if (local) {
      return local;
    }
  }

  async create(input: Product) {
    console.log(input);

    await inventoryRepository.save(input);
    const result = await createProduct(input);

    await inventoryRepository.save(result);
    return result;
  }

  async update(id: number, input: ProductInput) {
    const current = await inventoryRepository.get(id);

    if (!current) {
      throw new Error("product not found");
    }

    const optimistic: Product = {
      ...current,
      ...input,
      updated_at: new Date().toISOString(),
    };

    // همیشه اول لوکال

    await inventoryRepository.save(optimistic);

    if (networkService.isOnline()) {
      try {
        const server = await updateProduct(id, input);

        await inventoryRepository.save(server);

        return server;
      } catch {
        await queueService.add("inventory", id, "UPSERT", optimistic);
      }
    } else {
      await queueService.add("inventory", id, "UPSERT", optimistic);
    }

    return optimistic;
  }

  async remove(id: number) {
    await inventoryRepository.remove(id);

    if (networkService.isOnline()) {
      try {
        await deleteProduct(id);
      } catch {
        await queueService.add("inventory", id, "DELETE", null);
      }
    } else {
      await queueService.add("inventory", id, "DELETE", null);
    }
  }
}

export const inventoryService = new InventoryService();
