export const formatDateForAPI = (date: Date | undefined): string => {
  if (!date) return ''; // Return empty string or handle error as needed

  const localYear = date.getFullYear();
  const localMonth = date.getMonth() + 1; // getMonth() is 0-indexed
  const localDay = date.getDate();

  // Ensure month and day always have two digits
  const formattedMonth = String(localMonth).padStart(2, '0');
  const formattedDay = String(localDay).padStart(2, '0');

  // Create the string in YYYY-MM-DD format
  const formattedDate = `${localYear}-${formattedMonth}-${formattedDay}`;

  console.log(`📅 [dateUtils] Formatted date: input=${date.toString()}, output=${formattedDate}`);
  return formattedDate;
}; 