import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  company: z.string().min(2, { message: "Company name is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().optional(),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Message sent successfully",
        description: "We've received your inquiry and will contact you shortly.",
      });
      form.reset();
    }, 1000);
  }

  return (
    <>
      <SEO 
        title="Contact Us" 
        description="Contact Zilka-Kotab PC in San Jose, California. Schedule a consultation for patent strategy and intellectual property protection."
        url="/contact"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-20">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Contact Us</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Secure your intellectual property. Reach out to schedule a confidential consultation.
            </p>
          </FadeIn>
        </section>

        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            
            {/* Contact Form */}
            <div className="lg:col-span-7">
              <FadeIn delay={0.1}>
                <div className="bg-card border border-border p-8 md:p-10 rounded-2xl shadow-sm">
                  <h2 className="text-2xl font-display font-bold mb-8">Send an Inquiry</h2>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Jane Doe" {...field} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Tech" {...field} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input placeholder="jane@example.com" type="email" {...field} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="(555) 123-4567" type="tel" {...field} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="How can we help you?" 
                                className="min-h-[150px] resize-none" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" size="lg" className="w-full h-14 text-base mt-4" disabled={isSubmitting}>
                        {isSubmitting ? "Sending..." : "Submit Inquiry"}
                        {!isSubmitting && <Send className="ml-2 w-4 h-4" />}
                      </Button>
                    </form>
                  </Form>
                </div>
              </FadeIn>
            </div>

            {/* Contact Information */}
            <div className="lg:col-span-5 space-y-10">
              <FadeIn delay={0.2}>
                <div>
                  <h3 className="text-lg font-display font-semibold uppercase tracking-wider text-muted-foreground mb-6">Contact Info</h3>
                  <ul className="space-y-6">
                    <li className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Headquarters</p>
                        <p className="text-muted-foreground">1155 North 1st St #104<br/>San Jose, CA 95112</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Phone</p>
                        <a href="tel:408-971-2573" className="text-muted-foreground hover:text-primary transition-colors">(408) 971-2573</a>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Email</p>
                        <a href="mailto:patent@zilkakotab.com" className="text-muted-foreground hover:text-primary transition-colors">patent@zilkakotab.com</a>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Office Hours</p>
                        <p className="text-muted-foreground">Monday–Friday<br/>9:00 AM – 6:00 PM PT</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border shadow-sm">
                  <iframe 
                    title="Map of Zilka-Kotab PC"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3171.306079978713!2d-121.90807768469463!3d37.35914597983697!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808fccf0e2101211%3A0xcda6dc79e51c86fc!2s1155%20N%201st%20St%20%23104%2C%20San%20Jose%2C%20CA%2095112!5e0!3m2!1sen!2sus!4v1684346857121!5m2!1sen!2sus" 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              </FadeIn>
            </div>

          </div>
        </section>
      </main>
    </>
  );
}