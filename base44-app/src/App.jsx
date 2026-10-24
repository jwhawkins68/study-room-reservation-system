import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './auth/AuthContext';
import RequireRole from './auth/RequireRole';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CompleteProfile from './pages/CompleteProfile';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import AdminCenter from './pages/AdminCenter';
import ManageRooms from './pages/ManageRooms';
import AuditLog from './pages/AuditLog';
import ManageStaff from './pages/ManageStaff';

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
      <Route path="/complete-profile" element={<CompleteProfile />} />

      {/* Student portal (Sprints 1-2) */}
      <Route path="/student" element={student(<Dashboard />)} />
      <Route path="/student/rooms" element={student(<Rooms basePath="/student/rooms" />)} />
      <Route path="/student/rooms/:id" element={student(<RoomDetail backPath="/student/rooms" canBook />)} />

      {/* Staff portal (Sprint 3) */}
      <Route path="/staff" element={staff(<AdminCenter />)} />
      <Route path="/staff/rooms" element={staff(<ManageRooms />)} />
      <Route path="/staff/rooms/:id" element={staff(<RoomDetail backPath="/staff/rooms" staffView />)} />
      <Route path="/staff/book" element={staff(<Rooms basePath="/staff/book" />)} />
      <Route path="/staff/book/:id" element={staff(<RoomDetail backPath="/staff/book" canBook />)} />
      <Route path="/staff/bookings" element={staff(<Dashboard />)} />
      <Route path="/staff/audit" element={staff(<AuditLog />)} />
      <Route path="/staff/team" element={staff(<ManageStaff />)} />

      <Route path="*" element={<Fallback />} />
    </Routes>
  );
}
