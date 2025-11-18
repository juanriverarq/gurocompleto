import CalendarApp from 'src/components/app/calendar';

const CalendarPage = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendario</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Gestiona tus eventos y citas</p>
      </div>
      <CalendarApp />
    </div>
  );
};

export default CalendarPage;
