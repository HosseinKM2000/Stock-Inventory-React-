import { keycloak } from "./keycloak";

export async function initAuth() {
  const authenticated = await keycloak.init({
    onLoad: "check-sso",
    checkLoginIframe: false,
  });

  return authenticated;
}
