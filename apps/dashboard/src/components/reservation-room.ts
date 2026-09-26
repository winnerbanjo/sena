export function findReadyRoom(rooms: any[], reservation: { roomTypeId?: string; roomType?: string } | undefined) {
  if (!reservation) return undefined;
  return rooms.find(room =>
    (room.operationalStatus || room.operational) === 'available' &&
    ['clean', 'inspected'].includes(room.housekeepingStatus || room.housekeeping) &&
    (reservation.roomTypeId ? room.roomTypeId === reservation.roomTypeId : room.roomTypeName === reservation.roomType)
  );
}
