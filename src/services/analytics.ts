// src/services/analytics.ts - Analytics and reporting service

import type { Teacher, SchoolClass, Timetable, TimetableSlot, Student, SchoolData } from '../types'

export interface WorkloadMetrics {
  teacherId: string;
  teacherName: string;
  totalHours: number;
  dailyHours: number[];
  averageHoursPerDay: number;
  maxConsecutiveHours: number;
  workloadBalance: number; // 0-100, higher is better
  overTimeHours: number;
  underTimeHours: number;
}

export interface ClassMetrics {
  classId: string;
  className: string;
  totalHours: number;
  subjectsCount: number;
  averageHoursPerSubject: number;
  roomUtilization: number; // 0-100
  teacherDiversity: number; // Number of different teachers
  scheduleBalance: number; // 0-100
}

export interface ResourceMetrics {
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  utilizationRate: number; // 0-100
  turnoverRate: number; // Items per month
  mostUsedItems: InventoryItem[];
  leastUsedItems: InventoryItem[];
}

export interface PerformanceReport {
  workloadDistribution: WorkloadMetrics[];
  classDistribution: ClassMetrics[];
  resourceUtilization: ResourceMetrics;
  summary: {
    totalTeachers: number;
    totalClasses: number;
    totalStudents: number;
    averageTeacherHours: number;
    averageClassHours: number;
    resourceEfficiency: number;
  };
  recommendations: string[];
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
  }>;
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table' | 'list';
  data: any;
  config: {
    refreshInterval?: number;
    colorScheme?: string[];
    format?: 'percentage' | 'currency' | 'hours' | 'count';
  };
}

export class AnalyticsService {
  private schoolData: SchoolData;

  constructor(schoolData: SchoolData) {
    this.schoolData = schoolData;
  }

  /**
   * Generate comprehensive performance report
   */
  public generatePerformanceReport(): PerformanceReport {
    const workloadDistribution = this.calculateWorkloadDistribution();
    const classDistribution = this.calculateClassDistribution();
    const resourceUtilization = this.calculateResourceUtilization();
    const summary = this.generateSummary();
    const recommendations = this.generateRecommendations(workloadDistribution, classDistribution, resourceUtilization);

    return {
      workloadDistribution,
      classDistribution,
      resourceUtilization,
      summary,
      recommendations
    };
  }

  /**
   * Get teacher workload analytics
   */
  public getTeacherWorkloadAnalytics(): WorkloadMetrics[] {
    return this.calculateWorkloadDistribution();
  }

  /**
   * Get class distribution analytics
   */
  public getClassDistributionAnalytics(): ClassMetrics[] {
    return this.calculateClassDistribution();
  }

  /**
   * Get resource utilization analytics
   */
  public getResourceUtilizationAnalytics(): ResourceMetrics {
    return this.calculateResourceUtilization();
  }

  /**
   * Generate dashboard widgets
   */
  public generateDashboardWidgets(): DashboardWidget[] {
    const workloadDistribution = this.calculateWorkloadDistribution();
    const classDistribution = this.calculateClassDistribution();
    const resourceUtilization = this.calculateResourceUtilization();
    const summary = this.generateSummary();

    return [
      {
        id: 'teacher-workload-overview',
        title: 'Teacher Workload Overview',
        type: 'chart',
        data: this.generateWorkloadChart(workloadDistribution),
        config: {
          refreshInterval: 300000, // 5 minutes
          colorScheme: ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f']
        }
      },
      {
        id: 'class-distribution',
        title: 'Class Distribution',
        type: 'chart',
        data: this.generateClassDistributionChart(classDistribution),
        config: {
          refreshInterval: 300000,
          colorScheme: ['#9b59b6', '#1abc9c', '#e67e22', '#34495e']
        }
      },
      {
        id: 'resource-utilization',
        title: 'Resource Utilization',
        type: 'metric',
        data: {
          utilizationRate: resourceUtilization.utilizationRate,
          totalItems: resourceUtilization.totalItems,
          lowStockItems: resourceUtilization.lowStockItems
        },
        config: {
          format: 'percentage'
        }
      },
      {
        id: 'workload-summary',
        title: 'Workload Summary',
        type: 'metric',
        data: {
          averageHours: summary.averageTeacherHours,
          totalTeachers: summary.totalTeachers,
          overTimeTeachers: workloadDistribution.filter(w => w.overTimeHours > 0).length
        },
        config: {
          format: 'hours'
        }
      },
      {
        id: 'recommendations',
        title: 'Optimization Recommendations',
        type: 'list',
        data: this.generateRecommendations(workloadDistribution, classDistribution, resourceUtilization),
        config: {
          refreshInterval: 600000 // 10 minutes
        }
      }
    ];
  }

  /**
   * Calculate teacher workload distribution
   */
  private calculateWorkloadDistribution(): WorkloadMetrics[] {
    const workloadMetrics: WorkloadMetrics[] = [];

    this.schoolData.teachers.forEach(teacher => {
      const dailyHours = this.calculateTeacherDailyHours(teacher.id);
      const totalHours = dailyHours.reduce((sum, hours) => sum + hours, 0);
      const averageHoursPerDay = totalHours / 5; // Assuming 5 school days
      const maxConsecutiveHours = this.calculateMaxConsecutiveHours(teacher.id);
      const workloadBalance = this.calculateWorkloadBalance(dailyHours);
      const overTimeHours = Math.max(0, totalHours - teacher.maxHoursPerWeek);
      const underTimeHours = Math.max(0, teacher.maxHoursPerWeek - totalHours);

      workloadMetrics.push({
        teacherId: teacher.id,
        teacherName: teacher.name,
        totalHours,
        dailyHours,
        averageHoursPerDay,
        maxConsecutiveHours,
        workloadBalance,
        overTimeHours,
        underTimeHours
      });
    });

    return workloadMetrics.sort((a, b) => b.totalHours - a.totalHours);
  }

  /**
   * Calculate class distribution metrics
   */
  private calculateClassDistribution(): ClassMetrics[] {
    const classMetrics: ClassMetrics[] = [];

    this.schoolData.classes.forEach(schoolClass => {
      const totalHours = this.calculateClassTotalHours(schoolClass.id);
      const subjectsCount = this.calculateClassSubjectsCount(schoolClass.id);
      const averageHoursPerSubject = subjectsCount > 0 ? totalHours / subjectsCount : 0;
      const roomUtilization = this.calculateRoomUtilization(schoolClass.id);
      const teacherDiversity = this.calculateTeacherDiversity(schoolClass.id);
      const scheduleBalance = this.calculateScheduleBalance(schoolClass.id);

      classMetrics.push({
        classId: schoolClass.id,
        className: schoolClass.name,
        totalHours,
        subjectsCount,
        averageHoursPerSubject,
        roomUtilization,
        teacherDiversity,
        scheduleBalance
      });
    });

    return classMetrics.sort((a, b) => b.totalHours - a.totalHours);
  }

  /**
   * Calculate resource utilization metrics
   */
  private calculateResourceUtilization() {
    const totalItems = this.schoolData.inventory.items.length;
    const lowStockItems = this.schoolData.inventory.items.filter(item => item.quantity <= item.minQuantity).length;
    const totalValue = this.calculateTotalInventoryValue();
    const utilizationRate = this.calculateInventoryUtilizationRate();
    const turnoverRate = this.calculateInventoryTurnoverRate();

    return {
      totalItems,
      lowStockItems,
      totalValue,
      utilizationRate,
      turnoverRate
    };
  }

  public getInventoryAnalytics() {
    const metrics = this.calculateResourceUtilization();
    const mostUsedItems = this.getMostUsedItems();
    const leastUsedItems = this.getLeastUsedItems();

    return {
      ...metrics,
      mostUsedItems,
      leastUsedItems
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(): PerformanceReport['summary'] {
    const totalTeachers = this.schoolData.teachers.length;
    const totalClasses = this.schoolData.classes.length;
    const totalStudents = this.schoolData.students.length;
    const workloadDistribution = this.calculateWorkloadDistribution();
    const classDistribution = this.calculateClassDistribution();
    const resourceUtilization = this.calculateResourceUtilization();

    const averageTeacherHours = workloadDistribution.reduce((sum, w) => sum + w.totalHours, 0) / totalTeachers;
    const averageClassHours = classDistribution.reduce((sum, c) => sum + c.totalHours, 0) / totalClasses;
    const resourceEfficiency = resourceUtilization.utilizationRate;

    return {
      totalTeachers,
      totalClasses,
      totalStudents,
      averageTeacherHours,
      averageClassHours,
      resourceEfficiency
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    workloadDistribution: WorkloadMetrics[],
    classDistribution: ClassMetrics[],
    resourceUtilization: ResourceMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Workload recommendations
    const overTimeTeachers = workloadDistribution.filter(w => w.overTimeHours > 0);
    const underTimeTeachers = workloadDistribution.filter(w => w.underTimeHours > 5);

    if (overTimeTeachers.length > 0) {
      recommendations.push(`${overTimeTeachers.length} teacher(s) are overworked. Consider redistributing their hours.`);
    }

    if (underTimeTeachers.length > 0) {
      recommendations.push(`${underTimeTeachers.length} teacher(s) have underutilized capacity.`);
    }

    // Class recommendations
    const unbalancedClasses = classDistribution.filter(c => c.scheduleBalance < 70);
    if (unbalancedClasses.length > 0) {
      recommendations.push(`${unbalancedClasses.length} class(es) have unbalanced schedules.`);
    }

    // Resource recommendations
    if (resourceUtilization.lowStockItems > 0) {
      recommendations.push(`${resourceUtilization.lowStockItems} item(s) are below minimum stock levels.`);
    }

    if (resourceUtilization.utilizationRate < 50) {
      recommendations.push('Resource utilization is low. Consider optimizing allocation.');
    }

    return recommendations;
  }

  /**
   * Calculate teacher daily hours
   */
  private calculateTeacherDailyHours(teacherId: string): number[] {
    const dailyHours = [0, 0, 0, 0, 0]; // Monday to Friday
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    Object.entries(this.schoolData.timetables).forEach(([classId, classTimetable]) => {
      Object.entries(classTimetable).forEach(([day, daySlots]) => {
        const dayIndex = days.indexOf(day);
        if (dayIndex >= 0) {
          dailyHours[dayIndex] += daySlots.filter(slot => slot && slot.teacherId === teacherId).length;
        }
      });
    });

    return dailyHours;
  }

  /**
   * Calculate maximum consecutive hours for a teacher
   */
  private calculateMaxConsecutiveHours(teacherId: string): number {
    let maxConsecutive = 0;

    Object.entries(this.schoolData.timetables).forEach(([classId, classTimetable]) => {
      Object.entries(classTimetable).forEach(([day, daySlots]) => {
        let currentConsecutive = 0;

        daySlots.forEach((slot, slotIndex) => {
          if (slot && slot.teacherId === teacherId) {
            currentConsecutive++;
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
          } else {
            currentConsecutive = 0;
          }
        });
      });
    });

    return maxConsecutive;
  }

  /**
   * Calculate workload balance score (0-100)
   */
  private calculateWorkloadBalance(dailyHours: number[]): number {
    const averageHours = dailyHours.reduce((sum, hours) => sum + hours, 0) / 5;
    const variance = dailyHours.reduce((sum, hours) => sum + Math.pow(hours - averageHours, 2), 0) / 5;
    const stdDev = Math.sqrt(variance);

    // Normalize to 0-100 scale (lower std dev = higher balance)
    const balanceScore = Math.max(0, Math.min(100, 100 - (stdDev * 10)));
    return balanceScore;
  }

  /**
   * Calculate class total hours
   */
  private calculateClassTotalHours(classId: string): number {
    let totalHours = 0;

    const classTimetable = this.schoolData.timetables[classId] || {};
    Object.values(classTimetable).forEach(daySlots => {
      totalHours += daySlots.filter(slot => slot !== null).length;
    });

    return totalHours;
  }

  /**
   * Calculate number of subjects in a class
   */
  private calculateClassSubjectsCount(classId: string): number {
    const subjects = new Set<string>();
    const classTimetable = this.schoolData.timetables[classId] || {};

    Object.values(classTimetable).forEach(daySlots => {
      daySlots.forEach(slot => {
        if (slot) {
          subjects.add(slot.subject);
        }
      });
    });

    return subjects.size;
  }

  /**
   * Calculate room utilization percentage
   */
  private calculateRoomUtilization(classId: string): number {
    const classTimetable = this.schoolData.timetables[classId] || {};
    const totalSlots = Object.values(classTimetable).reduce((sum, daySlots) => sum + daySlots.length, 0);
    const occupiedSlots = Object.values(classTimetable).reduce((sum, daySlots) => 
      sum + daySlots.filter(slot => slot !== null).length, 0
    );

    return totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;
  }

  /**
   * Calculate teacher diversity (number of different teachers)
   */
  private calculateTeacherDiversity(classId: string): number {
    const teachers = new Set<string>();
    const classTimetable = this.schoolData.timetables[classId] || {};

    Object.values(classTimetable).forEach(daySlots => {
      daySlots.forEach(slot => {
        if (slot && slot.teacherId) {
          teachers.add(slot.teacherId);
        }
      });
    });

    return teachers.size;
  }

  /**
   * Calculate schedule balance score (0-100)
   */
  private calculateScheduleBalance(classId: string): number {
    const classTimetable = this.schoolData.timetables[classId] || {};
    const dailyHours = [0, 0, 0, 0, 0];

    Object.entries(classTimetable).forEach(([day, daySlots]) => {
      const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day);
      if (dayIndex >= 0) {
        dailyHours[dayIndex] = daySlots.filter(slot => slot !== null).length;
      }
    });

    const averageHours = dailyHours.reduce((sum, hours) => sum + hours, 0) / 5;
    const variance = dailyHours.reduce((sum, hours) => sum + Math.pow(hours - averageHours, 2), 0) / 5;
    const stdDev = Math.sqrt(variance);

    const balanceScore = Math.max(0, Math.min(100, 100 - (stdDev * 5)));
    return balanceScore;
  }

  /**
   * Calculate total inventory value
   */
  private calculateTotalInventoryValue(): number {
    // This would normally use actual item values
    // For now, we'll use a placeholder calculation
    return this.schoolData.inventory.items.length * 100; // Assume $100 average value
  }

  /**
   * Calculate inventory utilization rate
   */
  private calculateInventoryUtilizationRate(): number {
    const totalItems = this.schoolData.inventory.items.length;
    const usedItems = this.schoolData.inventory.items.filter(item => item.quantity < item.minQuantity * 2).length;
    
    return totalItems > 0 ? (usedItems / totalItems) * 100 : 0;
  }

  /**
   * Calculate inventory turnover rate
   */
  private calculateInventoryTurnoverRate(): number {
    // This would normally calculate based on transaction history
    // For now, return a placeholder value
    return 2.5; // Average turnover rate
  }

  /**
   * Get most used items
   */
  private getMostUsedItems(): InventoryItem[] {
    return this.schoolData.inventory.items
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  /**
   * Get least used items
   */
  private getLeastUsedItems(): InventoryItem[] {
    return this.schoolData.inventory.items
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5);
  }

  /**
   * Generate workload chart data
   */
  private generateWorkloadChart(workloadDistribution: WorkloadMetrics[]): ChartData {
    return {
      labels: workloadDistribution.map(w => w.teacherName),
      datasets: [{
        label: 'Total Hours',
        data: workloadDistribution.map(w => w.totalHours),
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
        borderWidth: 1
      }]
    };
  }

  /**
   * Generate class distribution chart data
   */
  private generateClassDistributionChart(classDistribution: ClassMetrics[]): ChartData {
    return {
      labels: classDistribution.map(c => c.className),
      datasets: [{
        label: 'Total Hours',
        data: classDistribution.map(c => c.totalHours),
        backgroundColor: '#2ecc71',
        borderColor: '#27ae60',
        borderWidth: 1
      }]
    };
  }

  /**
   * Update school data
   */
  public updateSchoolData(schoolData: SchoolData): void {
    this.schoolData = schoolData;
  }
}

// Utility function to create analytics service
export const createAnalyticsService = (schoolData: SchoolData): AnalyticsService => {
  return new AnalyticsService(schoolData);
}

export default AnalyticsService

