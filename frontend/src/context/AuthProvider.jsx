import { useState } from 'react';
import api from '../services/api';
import { AuthContext } from './authContext';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [rol, setRol] = useState(() => localStorage.getItem('rol'));
  const [esPrincipal, setEsPrincipal] = useState(() => localStorage.getItem('es_principal') === 'true');

  async function login(credenciales) {
    const { data } = await api.post('/api/auth/login', credenciales);
    console.log(data);
    localStorage.setItem('token', data.token);
    localStorage.setItem('rol', data.usuario.rol);
    localStorage.setItem('es_principal', String(Boolean(data.usuario.es_principal)));
    setToken(data.token);
    setRol(data.usuario.rol);
    setEsPrincipal(Boolean(data.usuario.es_principal));
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('es_principal');
    setToken(null);
    setRol(null);
    setEsPrincipal(false);
  }

  return (
    <AuthContext.Provider value={{ token, rol, esPrincipal, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}