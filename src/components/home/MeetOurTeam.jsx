import React from 'react';
    import { Card, CardTitle, CardDescription } from '@/components/ui/card';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';
    import founderImg from '@/assets/Founder.jpg';
    import coFounderImg from '@/assets/CoFounder.jpg';

    const MeetOurTeam = () => (
      <motion.section
        id="meet-our-team-section"
        className="py-16 md:py-24 bg-muted/30"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-4">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-12">Meet Our Team</motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-5xl mx-auto px-4">
            {[
              { name: "Utkarsh Srivastava", role: "Founder & Operations Lead", avatarSeed: "UtkarshS", alt: "Utkarsh Srivastava, Founder & CEO", img: founderImg },
              { name: "Prasoon Srivastava", role: "Co-Founder & Business Strategist", avatarSeed: "UtkarshS2", alt: "Utkarsh Srivastava, Head of Design & Operations", img: coFounderImg },
              // { name: "", role: "Customer Success Manager", avatarSeed: "PrasoonS", alt: "Prasoon Srivastava, Customer Success Manager" },
            ].map((member) => (
              <motion.div variants={itemVariants} key={member.name + member.role}>
                <Card className="text-center p-6 hover:shadow-2xl transition-shadow duration-300 ease-in-out bg-card/80 backdrop-blur-sm border-primary/20">
                  <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-primary">
                    {member.img ? (
                      <img alt={member.alt} className="w-full h-full object-cover rounded-full" src={member.img} />
                    ) : (
                      <img alt={member.alt} className="w-full h-full object-cover rounded-full" src="https://images.unsplash.com/photo-1544212408-c711b7c19b92" />
                    )}
                    <AvatarFallback>{member.name.substring(0,1)}{member.name.split(' ')[1]?.substring(0,1) || ''}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-xl text-foreground">{member.name}</CardTitle>
                  <CardDescription className="text-primary">{member.role}</CardDescription>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>
    );
    export default MeetOurTeam;