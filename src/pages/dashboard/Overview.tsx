import { StatisticsCards } from "@/features/dashboard/components/StatisticsCards";
import { OverviewChart } from "@/features/dashboard/components/OverviewChart";
import { ActivityFeed } from "@/features/dashboard/components/ActivityFeed";

export default function Overview() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <div className="flex items-center space-x-2">
          {/* Calendar or DatePicker could go here */}
        </div>
      </div>
      
      <StatisticsCards />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <OverviewChart />
        <ActivityFeed />
      </div>
    </div>
  );
}
