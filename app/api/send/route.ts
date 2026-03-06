import { Resend } from 'resend';

const resend = new Resend("re_GaBDKqcA_HdGBXftkLrcvUzB12HWhJbq7");

resend.apiKeys.list();

export async function POST() {
  const response = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: ['dev.juaki@gmail.com'],
    subject: 'hello world',
    html: '<strong>it works!</strong>',
  });

  console.log("Response:", response);

  return Response.json(response, {
    status: response.error ? 500 : 200,
  });
}