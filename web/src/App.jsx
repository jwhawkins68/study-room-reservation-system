import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './auth/AuthContext';
import RequireRole from './auth/RequireRole';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import StaffHome from './pages/StaffHome';

function Fallback() {
  const { user, loading } = useAuth();
  if (loading) return <p className="page-status">Loading…</p>;
  return <Navigate to={user ? homeFor(user) : '/'} replace />;
}

const student = (el) => <RequireRole role="student"><Layout>{el}</Layout></RequireRole>;
const staff = (el) => <RequireRole role="staff"><Layout>{el}</Layout></RequireRole>;

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Student portal */}
      <Route path="/student" element={student(<Dashboard />)} />
      <Route path="/student/rooms" element={student(<Rooms basePath="/student/rooms" />)} />
      <Route path="/student/rooms/:id" element={student(<RoomDetail backPath="/student/rooms" canBook />)} />

      {/* Staff portal */}
      <Route path="/staff" element={staff(<StaffHome />)} />
      <Route path="/staff/rooms/:id" element={staff(<RoomDetail backPath="/staff" />)} />

      <Route path="*" element={<Fallback />} />
    </Routes>
  );
}
