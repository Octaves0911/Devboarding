import UserDetail from '../../components/UserDetail';

export default function HRUserDetail() {
  return (
    <UserDetail
      readOnly={true}
      backPath="/hr/users"
      backLabel="Users"
      userDetailPath={(id) => `/hr/users/${id}`}
    />
  );
}
