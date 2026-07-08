import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, UserCheck, DollarSign } from "lucide-react";

export function StatisticsCards() {
  const stats = [
    {
      title: "Total Students",
      value: "1,240",
      change: "+12% from last month",
      icon: Users,
      trend: "up",
    },
    {
      title: "Active Teachers",
      value: "84",
      change: "+2 new this week",
      icon: UserCheck,
      trend: "up",
    },
    {
      title: "Total Classes",
      value: "42",
      change: "Stable",
      icon: BookOpen,
      trend: "neutral",
    },
    {
      title: "Revenue",
      value: "$34,200",
      change: "+8% from last month",
      icon: DollarSign,
      trend: "up",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Card key={i} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
