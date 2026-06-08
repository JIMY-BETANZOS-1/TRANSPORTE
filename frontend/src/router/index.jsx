import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import LoginPage from '../pages/LoginPage';
import BuscarPage from '../pages/BuscarPage';
import AsientosPage from '../pages/AsientosPage';
import PagoPage from '../pages/PagoPage';
import DashboardPage from '../pages/admin/DashboardPage';
import BusesPage from '../pages/admin/BusesPage';
import AdminsPage from '../pages/admin/AdminsPage';
import ViajesPage from '../pages/admin/ViajesPage';
import Navbar from '../components/Navbar';

function RootLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function AdminRoute() {
  const { token, rol } = useAuth();

  if (!token || rol !== 'admin') {
    return <Navigate to="/buscar" replace />;
  }

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/buscar" replace />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/buscar',
        element: <BuscarPage />,
      },
      {
        path: '/asientos/:viaje_id',
        element: <AsientosPage />,
      },
      {
        path: '/pago',
        element: <PagoPage />,
      },
      {
        path: '/pago/:reserva_id',
        element: <PagoPage />,
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: '/admin/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/admin/buses',
            element: <BusesPage />,
          },
          {
            path: '/admin/admins',
            element: <AdminsPage />,
          },
          {
            path: '/admin/viajes',
            element: <ViajesPage />,
          },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
