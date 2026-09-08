import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { RegisterPageComponent } from './register-page.component';

describe('RegisterPageComponent', () => {
  it('sends a newly registered learner to the welcome tour before home', async () => {
    const auth = {
      register: vi
        .fn()
        .mockResolvedValue({ id: 7, email: 'learner@example.com' }),
      safeReturnTo: vi.fn().mockReturnValue('/reports'),
    };
    const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [RegisterPageComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                returnTo: '/reports',
              }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.componentInstance.form.setValue({
      email: 'learner@example.com',
      password: 'password123',
    });

    await fixture.componentInstance.submit();

    expect(auth.register).toHaveBeenCalledWith(
      'learner@example.com',
      'password123',
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/welcome');
    expect(auth.safeReturnTo).not.toHaveBeenCalled();
  });
});
