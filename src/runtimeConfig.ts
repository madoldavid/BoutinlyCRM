export const runtimeConfig = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  /** Disable role impersonation in production. Set VITE_ALLOW_IMPERSONATION=false. */
  allowImpersonation: import.meta.env.VITE_ALLOW_IMPERSONATION !== 'false',
  /** Encrypt localStorage data. Set VITE_ENCRYPT_STORAGE=true in production. */
  encryptStorage: import.meta.env.VITE_ENCRYPT_STORAGE === 'true',
  /** Disable localStorage persistence entirely (data in memory + sessionStorage only). */
  disableLocalStorage: import.meta.env.VITE_DISABLE_LOCAL_STORAGE === 'true',
};
