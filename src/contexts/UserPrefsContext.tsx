import { createContext, useContext, useState } from 'react';

interface UserPrefs {
  tutorialEnabled: boolean;
  setTutorialEnabled: (v: boolean) => void;
}

const UserPrefsContext = createContext<UserPrefs>({
  tutorialEnabled: true,
  setTutorialEnabled: () => {},
});

export function UserPrefsProvider({ children }: { children: React.ReactNode }) {
  const [tutorialEnabled, setTutorialEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('pref_tutorial') !== 'false';
  });

  const setTutorialEnabled = (v: boolean) => {
    setTutorialEnabledState(v);
    localStorage.setItem('pref_tutorial', String(v));
  };

  return (
    <UserPrefsContext.Provider value={{ tutorialEnabled, setTutorialEnabled }}>
      {children}
    </UserPrefsContext.Provider>
  );
}

export const useUserPrefs = () => useContext(UserPrefsContext);
