import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  console.log('🔄 [PROTECTED] Route check:', { loading, user: !!user });

  if (loading) {
    console.log('🔄 [PROTECTED] Still loading, showing loading screen');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ [PROTECTED] No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ [PROTECTED] User authenticated, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute;