import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

export default function useUnsavedChanges(
  hasUnsavedChanges,
  {
    allowNavigationRef,
    message = 'Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?',
  } = {}
) {
  const confirmationRef = useRef(null);
  const navigationBlocker = useBlocker(({ currentLocation, nextLocation }) => {
    const currentUrl = `${currentLocation.pathname}${currentLocation.search}`;
    const nextUrl = `${nextLocation.pathname}${nextLocation.search}`;
    return hasUnsavedChanges && !allowNavigationRef?.current && currentUrl !== nextUrl;
  });

  useEffect(() => {
    if (navigationBlocker.state !== 'blocked') {
      confirmationRef.current = null;
      return;
    }
    if (confirmationRef.current === navigationBlocker.location.key) return;
    confirmationRef.current = navigationBlocker.location.key;
    if (window.confirm(message)) navigationBlocker.proceed();
    else navigationBlocker.reset();
  }, [navigationBlocker, message]);

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (!hasUnsavedChanges || allowNavigationRef?.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges, allowNavigationRef]);
}
