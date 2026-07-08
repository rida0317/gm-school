import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ActivityFeed() {
  const activities = [
    { id: 1, text: "New student enrolled in Class 10A", time: "2 hours ago", type: "enrollment" },
    { id: 2, text: "Teacher John Doe uploaded grades for Math", time: "4 hours ago", type: "grade" },
    { id: 3, text: "Monthly payment received from Parent ID 442", time: "5 hours ago", type: "payment" },
    { id: 4, text: "System backup completed successfully", time: "1 day ago", type: "system" },
  ];

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{activity.text}</p>
                <p className="text-sm text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
