import { httpClient } from "./httpClient";

export async function getHealth(options = {}) {
    return httpClient.get("/health", options);
}
