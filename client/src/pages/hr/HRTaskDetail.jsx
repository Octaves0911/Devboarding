import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import TaskDetail from '../../components/TaskDetail';

export default function HRTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignees, setAssignees] = useState([]);

  useEffect(() => {
    api.get('/users').then((res) => {
      setAssignees(
        res.data.users.filter((u) => u.isActive && ['HR', 'MENTOR', 'MENTEE'].includes(u.role))
      );
    });
  }, []);

  return (
    <TaskDetail
      taskId={Number(id)}
      assignees={assignees}
      backLabel="Tasks"
      onBack={() => navigate('/hr/tasks')}
      onDelete={() => navigate('/hr/tasks')}
    />
  );
}
