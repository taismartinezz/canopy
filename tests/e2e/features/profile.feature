Feature: Profile photos

  Scenario: Profile photo displays when set
    Given I am logged in
    And my profile has an avatar URL
    When I view my profile
    Then I should see my profile photo as an img element

  Scenario: Initials show when no photo set
    Given I am logged in
    And my profile has no avatar URL
    When I view my profile
    Then I should see my initials avatar
