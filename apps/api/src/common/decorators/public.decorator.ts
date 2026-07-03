import { SetMetadata } from "@nestjs/common";

/** Marks a route as accessible without authentication (skips the global JWT guard). */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
