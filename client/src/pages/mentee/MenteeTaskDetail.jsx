import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import TaskDetail from '../../components/TaskDetail';

export default function MenteeTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [taskIds, setTaskIds] = useState([]);

  useEffect(() => {
    api.get('/tasks?scope=assigned').then((res) => {
      setTaskIds(res.data.tasks.map((t) => t.id));
    });
  }, []);

  const currentIndex = taskIds.indexOf(Number(id));
  const prevId = currentIndex > 0 ? taskIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < taskIds.length - 1 ? taskIds[currentIndex + 1] : null;

  return (
    <TaskDetail
      taskId={Number(id)}
      assignees={null}
      backLabel="My Tasks"
      onBack={() => navigate('/mentee/tasks')}
      onDelete={() => navigate('/mentee/tasks')}
      prevId={prevId}
      nextId={nextId}
      onNavigate={(newId) => navigate(`/mentee/tasks/${newId}`)}
    />
  );
}
