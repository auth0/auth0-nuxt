import type { TeamMember } from '~/data/team';

export function useTeam() {
  const searchQuery = ref('');
  const selectedDepartment = ref('all');
  const teamMembers = useState<TeamMember[]>('teamMembers', () => []);

  // Fetch team members from the API (server handles token)
  const { data: teamData } = useFetch<{ members: TeamMember[] }>('/api/team');

  // Update state when data is loaded
  watch(teamData, (newData) => {
    if (newData?.members) {
      teamMembers.value = newData.members;
    }
  }, { immediate: true });

  const filteredMembers = computed(() => {
    let filtered = teamMembers.value;

    if (selectedDepartment.value !== 'all') {
      filtered = filtered.filter(member => member.department === selectedDepartment.value);
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  const departments = computed(() =>
    ['all', ...new Set(teamMembers.value.map(m => m.department))]
  );

  const stats = computed(() => ({
    totalMembers: teamMembers.value.length,
    onlineMembers: teamMembers.value.filter(m => m.status === 'online').length,
    departmentCount: departments.value.length - 1,
    totalTasks: teamMembers.value.reduce((sum, m) => sum + m.tasksCount, 0),
  }));

  return {
    teamMembers,
    searchQuery,
    selectedDepartment,
    filteredMembers,
    departments,
    stats,
  };
}
