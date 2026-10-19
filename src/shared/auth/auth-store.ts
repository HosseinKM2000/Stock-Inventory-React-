import type { User } from "@/features/auth/types";

let currentUser: User | null = null;

export function setCurrentUser(user: User | null) {
    currentUser = user;
}

export function getCurrentUser() {
    return currentUser;
}