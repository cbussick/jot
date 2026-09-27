import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { passwordSchema } from '../../shared/contracts';
import { api } from '../api';
import { styles } from '../app.stylex';

export function Auth({ setupRequired, onAuthenticated }: { setupRequired: boolean; onAuthenticated: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success && setupRequired) return setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
    setBusy(true); setError('');
    try {
      if (setupRequired) await api.setup(password); else await api.login(password);
      onAuthenticated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
      setBusy(false);
    }
  };
  return <main {...stylex.props(styles.loginPage)}><form onSubmit={submit} {...stylex.props(styles.loginCard)}>
    <Brand/>
    <h1 {...stylex.props(styles.loginTitle)}>{setupRequired ? 'Make jot. yours' : 'Welcome back'}</h1>
    <p {...stylex.props(styles.loginCopy)}>{setupRequired ? 'Choose the password for this private instance. Use at least 12 characters.' : 'Enter your password to open your notes.'}</p>
    <label className="sr-only" htmlFor="password">Password</label><input id="password" type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} required value={password} onChange={event => setPassword(event.target.value)} {...stylex.props(styles.password)}/>
    <p role="alert" {...stylex.props(styles.error)}>{error}</p>
    <button type="submit" disabled={busy} {...stylex.props(styles.primary, styles.fullButton)}>{busy ? 'Please wait…' : setupRequired ? 'Create private instance' : 'Open jot.'}</button>
  </form></main>;
}

export function Brand() {
  return <span {...stylex.props(styles.brand)}><span aria-hidden="true" {...stylex.props(styles.brandMark)}><i {...stylex.props(styles.brandLine)}/><i {...stylex.props(styles.brandLine, styles.brandLineTwo)}/><i {...stylex.props(styles.brandFold)}/></span><span>jot<span {...stylex.props(styles.brandDot)}>.</span></span></span>;
}
