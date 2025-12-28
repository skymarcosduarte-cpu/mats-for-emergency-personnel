import React from 'react';
import { InternalMessagesContext, useInternalMessagesStore } from '@/hooks/useInternalMessages';

export const InternalMessagesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const store = useInternalMessagesStore();

  return (
    <InternalMessagesContext.Provider value={store}>
      {children}
    </InternalMessagesContext.Provider>
  );
};
