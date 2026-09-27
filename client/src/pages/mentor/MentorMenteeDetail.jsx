import UserDetail from '../../components/UserDetail';

export default function MentorMenteeDetail() {
  return (
    <UserDetail
      readOnly={true}
      backPath="/mentor/mentees"
      backLabel="My Mentees"
      userDetailPath={(id) => `/mentor/mentees/${id}`}
    />
  );
}
