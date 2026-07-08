export const QUERY_KEYS = {
  AUTH: {
    ME: ["auth", "me"] as const,
  },

  COURSE: {
    LIST: ["courses"] as const,

    DETAIL: (id: string) =>
      ["courses", id] as const,
  },

  BOOK: {
    LIST: ["books"] as const,
  },

  CART: {
    CURRENT: ["cart"] as const,
  },
};