'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  UserPlus,
  Clock,
  Copy,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  SessionInvitation, 
  CreateInvitationData, 
  ParticipantRole, 
  InvitationStatus 
} from '@/types';

interface SessionInvitationsProps {
  sessionId: string;
  isInstructor: boolean;
  className?: string;
}

export function SessionInvitations({ 
  sessionId, 
  isInstructor, 
  className 
}: SessionInvitationsProps) {
  const [invitations, setInvitations] = useState<SessionInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const mockInvitations: SessionInvitation[] = [
        {
          id: 'inv_1',
          sessionId,
          inviterId: 'user_1',
          email: 'student@example.com',
          role: 'LEARNER',
          status: 'PENDING',
          token: 'abc123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ];
      setInvitations(mockInvitations);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isInstructor) {
      fetchInvitations();
    }
  }, [sessionId, isInstructor, fetchInvitations]);

  const handleCreateInvitation = async (data: CreateInvitationData) => {
    try {
      // TODO: Replace with actual API call
      const newInvitation: SessionInvitation = {
        id: `inv_${Date.now()}`,
        sessionId: data.sessionId,
        inviterId: 'current_user_id', // TODO: Get from auth context
        email: data.email,
        inviteeId: data.userId,
        role: data.role,
        status: 'PENDING',
        token: Math.random().toString(36).substring(2, 15),
        expiresAt: new Date(Date.now() + (data.expiresIn || 24) * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setInvitations(prev => [...prev, newInvitation]);
      setShowInviteForm(false);
    } catch (error) {
      console.error('Failed to create invitation:', error);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      // TODO: Replace with actual API call
      console.log('Resending invitation:', invitationId);
    } catch (error) {
      console.error('Failed to resend invitation:', error);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      // TODO: Replace with actual API call
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (error) {
      console.error('Failed to revoke invitation:', error);
    }
  };

  const copyInvitationLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/sessions/join/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    // TODO: Show toast notification
  };

  if (!isInstructor) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Session Invitations</h3>
        <Button
          onClick={() => setShowInviteForm(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Invite Participants
        </Button>
      </div>

      {showInviteForm && (
        <InviteForm
          sessionId={sessionId}
          onSubmit={handleCreateInvitation}
          onCancel={() => setShowInviteForm(false)}
        />
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : invitations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                No invitations sent yet. Invite participants to join your session.
              </p>
            </CardContent>
          </Card>
        ) : (
          invitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onResend={handleResendInvitation}
              onRevoke={handleRevokeInvitation}
              onCopyLink={copyInvitationLink}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface InviteFormProps {
  sessionId: string;
  onSubmit: (data: CreateInvitationData) => void;
  onCancel: () => void;
}

function InviteForm({ sessionId, onSubmit, onCancel }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ParticipantRole>('LEARNER');
  const [expiresIn, setExpiresIn] = useState(24);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    onSubmit({
      sessionId,
      email: email.trim(),
      role,
      expiresIn,
    });

    // Reset form
    setEmail('');
    setRole('LEARNER');
    setExpiresIn(24);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Invite Participant</CardTitle>
        <CardDescription>
          Send an invitation to join this coding session
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="participant@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium mb-2">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as ParticipantRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LEARNER">Learner</option>
              <option value="OBSERVER">Observer</option>
              <option value="INSTRUCTOR">Co-Instructor</option>
            </select>
          </div>

          <div>
            <label htmlFor="expires" className="block text-sm font-medium mb-2">
              Expires In (hours)
            </label>
            <Input
              id="expires"
              type="number"
              value={expiresIn}
              onChange={(e) => setExpiresIn(parseInt(e.target.value) || 24)}
              min="1"
              max="168"
              placeholder="24"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Send Invitation
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface InvitationCardProps {
  invitation: SessionInvitation;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  onCopyLink: (token: string) => void;
}

function InvitationCard({ 
  invitation, 
  onResend, 
  onRevoke, 
  onCopyLink 
}: InvitationCardProps) {
  const getStatusColor = (status: InvitationStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'DECLINED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isExpired = new Date() > new Date(invitation.expiresAt);
  const timeUntilExpiry = new Date(invitation.expiresAt).getTime() - Date.now();
  const hoursUntilExpiry = Math.max(0, Math.floor(timeUntilExpiry / (1000 * 60 * 60)));

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="font-medium">
                {invitation.email || invitation.invitee?.email || 'Unknown'}
              </span>
              <Badge variant="outline" className="text-xs">
                {invitation.role.toLowerCase()}
              </Badge>
              <Badge className={cn('text-xs', getStatusColor(invitation.status))}>
                {invitation.status.toLowerCase()}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isExpired ? (
                  <span className="text-red-500">Expired</span>
                ) : (
                  <span>Expires in {hoursUntilExpiry}h</span>
                )}
              </div>
              <span>
                Sent {new Date(invitation.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invitation.status === 'PENDING' && !isExpired && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCopyLink(invitation.token)}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResend(invitation.id)}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Resend
                </Button>
              </>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRevoke(invitation.id)}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
              Revoke
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
