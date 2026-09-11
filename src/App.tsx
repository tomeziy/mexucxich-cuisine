import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { Layout } from './components/layout/Layout';
import { PosPage } from './pages/PosPage';
import { ProductsPage } from './pages/ProductsPage';
import { ReportsPage } from './pages/ReportsPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <StoreProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PosPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </StoreProvider>
  );
};

export default App;
