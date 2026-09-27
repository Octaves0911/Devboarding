import UserDetail from '../../components/UserDetail';

export default function AdminUserDetail() {
  return (
    <UserDetail
      readOnly={false}
      backPath="/admin/users"
      backLabel="Users"
      userDetailPath={(id) => `/admin/users/${id}`}
    />
  );
}
