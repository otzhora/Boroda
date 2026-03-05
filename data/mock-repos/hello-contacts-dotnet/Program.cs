var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var contacts = new List<Contact>
{
  new(1, "Ada Lovelace", "ada@example.test"),
  new(2, "Grace Hopper", "grace@example.test")
};

app.MapGet("/", () => Results.Ok(new { message = "Hello from Contacts API" }));
app.MapGet("/contacts", () => Results.Ok(contacts));

app.MapPost("/contacts", (ContactInput input) =>
{
  var nextId = contacts.Count == 0 ? 1 : contacts.Max(item => item.Id) + 1;
  var created = new Contact(nextId, input.Name.Trim(), input.Email.Trim());
  contacts.Add(created);
  return Results.Created($"/contacts/{created.Id}", created);
});

app.MapPut("/contacts/{id:int}", (int id, ContactInput input) =>
{
  var index = contacts.FindIndex(item => item.Id == id);
  if (index < 0) return Results.NotFound();

  contacts[index] = new Contact(id, input.Name.Trim(), input.Email.Trim());
  return Results.Ok(contacts[index]);
});

app.MapDelete("/contacts/{id:int}", (int id) =>
{
  var removed = contacts.RemoveAll(item => item.Id == id);
  return removed == 0 ? Results.NotFound() : Results.NoContent();
});

app.Run();

record Contact(int Id, string Name, string Email);
record ContactInput(string Name, string Email);
