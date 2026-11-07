import { inject, RESPONSE_INIT } from '@angular/core';

/** Sets the HTTP status of the server-rendered response (no-op in the browser). */
export function useResponseStatus() {
  const init = inject(RESPONSE_INIT, { optional: true });
  return (status: number) => {
    if (init) init.status = status;
  };
}
