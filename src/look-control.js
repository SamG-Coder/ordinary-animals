// Menus suspend the player's chosen mouse-look mode. Only the player's own
// return/continue gesture requests it again; Escape during exploration cancels it.
export function createLookControl({
  isLocked,
  request,
  release,
  canLook,
  onFallback,
}) {
  let wanted = false,
    suspended = false;
  function resume() {
    suspended = false;
    if (!wanted || !canLook() || isLocked()) return;
    try {
      request()?.catch?.(onFallback);
    } catch {
      onFallback();
    }
  }
  return {
    prepare() { wanted = true; suspended = true; },
    engage() {
      wanted = true;
      resume();
    },
    suspend() {
      wanted ||= isLocked();
      suspended = true;
      if (isLocked()) release();
    },
    resume,
    changed() {
      if (!isLocked() && !suspended && canLook()) wanted = false;
    },
    forget() {
      wanted = false;
      suspended = false;
    },
  };
}
