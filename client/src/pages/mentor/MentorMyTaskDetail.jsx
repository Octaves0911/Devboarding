import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import TaskDetail from '../../components/TaskDetail';

export default function MentorMyTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignees, setAssignees] = useState([]);

  useEffect(() => {
    api.get('/users/my-mentees').then((res) => {
      setAssignees(res.data.mentees);
    });
  }, []);

  return (
    <TaskDetail
      taskId={Number(id)}
      assignees={assignees}
      backLabel="My Tasks"
      onBack={() => navigate('/mentor/my-tasks')}
      onDelete={() => navigate('/mentor/my-tasks')}
    />
  );
}
