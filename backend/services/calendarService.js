
const axios = require('axios');
const Holiday = require('../models/Holiday');

class CalendarService {
  constructor() {
    // Removed Google Calendar API configuration
  }

  async checkIfHoliday(date) {
    try {
      // Check local database for holidays
      const localHoliday = await Holiday.findOne({
        date: {
          $gte: new Date(date.setHours(0, 0, 0, 0)),
          $lt: new Date(date.setHours(23, 59, 59, 999))
        }
      });

      if (localHoliday) {
        return {
          isHoliday: true,
          name: localHoliday.name,
          type: localHoliday.type,
          source: 'local'
        };
      }

      return { isHoliday: false };
    } catch (error) {
      console.error('Error checking holiday:', error);
      return { isHoliday: false };
    }
  }

  async addHoliday(name, date, type = 'college', userId) {
    try {
      const holiday = await Holiday.create({
        name,
        date: new Date(date),
        type,
        createdBy: userId
      });

      return holiday;
    } catch (error) {
      console.error('Error adding holiday:', error);
      throw error;
    }
  }

  async getUpcomingHolidays(days = 30) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const holidays = await Holiday.find({
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1 });

      return holidays;
    } catch (error) {
      console.error('Error getting upcoming holidays:', error);
      return [];
    }
  }
}

module.exports = new CalendarService();
