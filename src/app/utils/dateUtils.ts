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

// Function to calculate the number of nights between two dates
export const calculateNumberOfNights = (checkIn: string | Date, checkOut: string | Date): number => {
  const checkInDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const checkOutDate = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    console.error('[dateUtils] Invalid date format for calculating nights:', checkIn, checkOut);
    return 0; // Return 0 or throw error if dates are invalid
  }

  // Calculate the difference in time
  const timeDifference = checkOutDate.getTime() - checkInDate.getTime();

  // Calculate the difference in days
  const dayDifference = timeDifference / (1000 * 60 * 60 * 24);

  // Use Math.ceil to handle potential daylight saving changes or exact check-out times
  // Ensure at least 1 night is returned if check-in and check-out are the same day (or invalid range)
  const numNights = Math.max(1, Math.ceil(dayDifference));

  console.log(`📅 [dateUtils] Calculated nights: checkIn=${checkInDate.toISOString()}, checkOut=${checkOutDate.toISOString()}, nights=${numNights}`);
  return numNights;
}; 